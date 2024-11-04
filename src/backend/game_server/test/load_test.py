import os
from threading import Thread

import json
import time
import redis

import socketio

NUM_PLAYERS = 400
GAMES_PER_PLAYER = 1

import logging
import sys

root = logging.getLogger()
root.setLevel(logging.DEBUG)
formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
# Create a file handler to log messages to a file
file_handler = logging.FileHandler('test_report.log', mode='w')
file_handler.setLevel(logging.DEBUG)
file_handler.setFormatter(formatter)

console_handler = logging.StreamHandler(sys.stdout)
console_handler.setLevel(logging.DEBUG)
console_handler.setFormatter(formatter)

root.addHandler(console_handler)
root.addHandler(file_handler)

ERROR = 2
COMPLETED = 0
TIMEOUT = 1
ABORTED = 3
TIMERUNOUT = 4


def run_test(results: list, index: int):
    logging.info(f"Running test number {index}")
    start = time.time()
    test(results, index)
    logging.info(f"Test #{index} lasted {time.time() - start} seconds")


class UtilityHelper:

    def __init__(self):
        self.player_sid = None
        self.line_index = 0
        self.color = 'w'
        self.ready = False
        self.seen_moves = set()
        self.last_heartbeat = None
        self.redis_cli = redis.Redis(host=os.getenv("REDIS_HOST", "localhost"),
                                     port=int(os.getenv("REDIS_PORT", 6379)),
                                     decode_responses=True)
        self.game_over = False


def test(results: list, index: int):

    for i in range(GAMES_PER_PLAYER):
        try:
            with socketio.SimpleClient(logger=False, engineio_logger=False) as sio:

                util = UtilityHelper()

                sio.connect(url=os.getenv("ENDPOINT", "https://www.chessmine.xyz/"), namespace='/connect', transports=['websocket'])
                f = open('test/resources/checkmate.json', 'r')
                lines = tuple(f)
                f.close()

                @sio.client.on('move', namespace='/connect')
                def move(data):
                    # Assert we got back the move we're supposed to get
                    if len(util.seen_moves) == 0:
                        # In case color and line_index weren't set by primary thread yet, we wait for it before sending out our own first move
                        while not util.ready:
                            time.sleep(2)
                    if isinstance(data, dict):
                        logging.debug(f'Got move for sid {util.player_sid} and payload: {data}')
                        move_hash = hash(json.dumps(data.get('move')))
                        if move_hash not in util.seen_moves and util.color != data.get('move').get('color') and util.line_index < len(lines):
                            util.seen_moves.add(move_hash)

                            try:
                                if not util.last_heartbeat or time.time() - util.last_heartbeat > 3:
                                    # heartbeat only in case of no prior heartbeats or previous heartbeat was over 3 seconds ago
                                    sio.client.call('/api/heartbeat', {'checkin': True,
                                                                       'data': {'sid': util.player_sid,
                                                                                'preferences': {'time_control': '5+0'}}},
                                                    namespace='/connect', timeout=2)
                                    util.last_heartbeat = time.time()
                                # The relation between seen_moves and line_index follow a specific formula.
                                # black: (len(seen_moves) * 2 - 1 == line_index. white: (len(seen_moves) * 2 == line_index
                                # In case it is not, we might send the same move twice and miss sending the correct
                                # move. If the opponent is quick and sent out a move in response to our last move
                                # while we haven't updated line_index yet, we might respond with the wrong line_index
                                # So sending out a move is predicated on working with the most up-to-date line_index
                                while (len(util.seen_moves) * 2) - (0 if util.color == 'w' else 1) != util.line_index:
                                    time.sleep(2)
                                sio.client.call('/api/move', {'sid': util.player_sid, 'move': json.loads(lines[util.line_index])},
                                                namespace='/connect', timeout=2)
                            except Exception as exc:
                                results[index][TIMEOUT] += 1
                                logging.error(f'Connection error {exc.__class__.__name__} while sending move: '
                                              f'{json.loads(lines[util.line_index])} for sid {util.player_sid}')
                                # retry without the timeout limit in case the move wasn't registered
                                sio.client.call('/api/move',
                                                {'sid': util.player_sid, 'move': json.loads(lines[util.line_index])},
                                                namespace='/connect')
                            util.line_index += 2

                @sio.client.on('game_over', namespace='/connect')
                def game_over(data):
                    logging.info(f"Received game_over {data} for sid {util.player_sid}")
                    msg = data.get('message')
                    if 'ran out of time' in msg:
                        results[index][TIMERUNOUT] += 1
                    elif 'aborted' in msg:
                        results[index][ABORTED] += 1
                    elif 'white checkmated' in msg:
                        results[index][COMPLETED] += 1
                    else:
                        results[index][ERROR] += 1
                    util.game_over = True

                @sio.client.on('game', namespace='/connect')
                def game(data):
                    if isinstance(data, str):
                        util.player_sid = data

                util.player_sid = sio.client.emit(event='/api/play', data={'data': {'preferences': {'time_control': '3+0', }}},
                                                  namespace='/connect', callback=game)

                # Allow time for matching
                time.sleep(10)

                # assert game mappings
                game_id = util.redis_cli.hget(f'player_mapping_{util.player_sid}', 'game_id')
                game_mapping = util.redis_cli.hgetall(f'game_mapping_{game_id}')
                white_sid = game_mapping.get('white')
                if white_sid != util.player_sid:
                    # We are black
                    util.line_index = 1
                    util.color = 'b'
                    util.ready = True
                else:
                    util.ready = True
                    sio.client.emit('/api/move', {'sid': util.player_sid, 'move': json.loads(lines[util.line_index])},
                                    namespace='/connect', callback=move)
                    util.line_index += 2

                while not util.game_over:
                    time.sleep(2)

                sio.disconnect()
        except Exception as e:
            logging.error(f'Got exception of {e}')
            results[index][ERROR] += 1


threads = []
results = []
redis_cli = redis.Redis(host=os.getenv("REDIS_HOST", "localhost"),
                        port=int(os.getenv("REDIS_PORT", 6379)),
                        decode_responses=True)
redis_cli.flushdb()
start = time.time()

for n in range(NUM_PLAYERS):
    results.append([0, 0, 0, 0, 0])
    t = Thread(target=run_test, args=(results, n))
    t.start()
    threads.append(t)

# Wait for all threads to finish.
for t in threads:
    t.join(300)     # 10 min. timeout

end = time.time()

# assert that all went well
sum = 0
iter = 0
timeouts = 0
errors = 0
aborts = 0
timerunouts = 0
for result in results:
    logging.info(f'Test #{iter} completed with {result[ERROR]} errors, {result[TIMEOUT]} timeouts and {result[COMPLETED]} completed games')
    iter += 1
    sum += result[COMPLETED]
    timeouts += result[TIMEOUT]
    errors += result[ERROR]
    aborts += result[ABORTED]
    timerunouts += result[TIMERUNOUT]


games_planned = int((NUM_PLAYERS * GAMES_PER_PLAYER) / 2)
games_played = int(sum / 2)
success_rate = float("{:.2f}".format(100 * (sum/(NUM_PLAYERS * GAMES_PER_PLAYER))))
throughput = float("{:.3f}".format((NUM_PLAYERS * GAMES_PER_PLAYER)/2/(end - start)))
logging.info(f"************************************\n\n\n")
logging.info(f"Total game testing lasted {end - start} seconds")
logging.info(f"************************************\n")
logging.info(f'Tests completed with {timeouts} timeouts, {errors} errors, {aborts} aborts, {timerunouts} timerunouts and {games_played}/{games_planned} completed games')
logging.info(f"************************************\n")
logging.info(f'Games completed: {games_played} completed games with {success_rate}% success rate')
logging.info(f"************************************\n")
logging.info(f'Game throughput: {throughput}')
logging.info(f"************************************\n\n\n")

assert sum == (NUM_PLAYERS * GAMES_PER_PLAYER)

games = redis_cli.keys("game_mapping_*")
assert len(games) == (NUM_PLAYERS * GAMES_PER_PLAYER)/2

endgames = redis_cli.keys("game_endgame_*")
assert len(endgames) == (NUM_PLAYERS * GAMES_PER_PLAYER)/2

sessions = redis_cli.keys("player_session_*")
assert len(sessions) == NUM_PLAYERS * GAMES_PER_PLAYER

mappings = redis_cli.keys("player_mapping_*")
assert len(mappings) == NUM_PLAYERS * GAMES_PER_PLAYER

players = set()
for game in games:
    game_mapping = redis_cli.hgetall(game)
    players.add(game_mapping.get('white'))
    players.add(game_mapping.get('black'))
assert len(players) == NUM_PLAYERS * GAMES_PER_PLAYER
