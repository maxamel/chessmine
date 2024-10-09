from threading import Thread

import json
import time
import redis

import socketio

NUM_PLAYERS = 150
GAMES_PER_PLAYER = 2


def run_test(results: list, index: int):
    print(f"Running test number {index}")
    start = time.time()
    test(results, index)
    print(f"Test #{index} lasted {time.time() - start} seconds")


class UtilityHelper:

    def __init__(self):
        self.player_sid = None
        self.line_index = 0
        self.color = 'w'
        self.seen_moves = set()
        self.redis_cli = redis.Redis(decode_responses=True)
        self.game_over = False


def test(results: list, index: int):

    for i in range(GAMES_PER_PLAYER):
        try:
            with socketio.SimpleClient() as sio:

                util = UtilityHelper()

                sio.connect(url='http://localhost:5000/connect', namespace='/connect')
                f = open('test/resources/checkmate.json', 'r')
                lines = tuple(f)
                f.close()

                @sio.client.on('move', namespace='/connect')
                def move(data):
                    # Assert we got back the move we're supposed to get
                    if isinstance(data, dict):
                        move_hash = hash(json.dumps(data.get('move')))
                        if move_hash not in util.seen_moves and util.color != data.get('move').get('color') and util.line_index < len(lines):
                            util.seen_moves.add(move_hash)
                            sio.client.emit('/api/heartbeat', {'checkin': True,
                                                               'data': {'sid': util.player_sid, 'preferences': {'time_control': '5+0'}}},
                                            namespace='/connect')
                            sio.client.emit('/api/move', {'sid': util.player_sid, 'move': json.loads(lines[util.line_index])},
                                            namespace='/connect', callback=move)
                            util.line_index += 2

                @sio.client.on('game_over', namespace='/connect')
                def game_over(data):
                    print(f"Received game_over {data} for sid {util.player_sid}")
                    aborted = 'aborted' in data.get('message')
                    if aborted:
                        results[index][1] += 1
                    else:
                        results[index][0] += 1
                    util.game_over = True

                @sio.client.on('game', namespace='/connect')
                def game(data):
                    #print(f"Received game data: {data}")
                    if isinstance(data, str):
                        util.player_sid = data

                util.player_sid = sio.client.emit(event='/api/play', data={'data': {'preferences': {'time_control': '5+0', }}},
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
                else:
                    sio.client.emit('/api/move', {'sid': util.player_sid, 'move': json.loads(lines[util.line_index])},
                                    namespace='/connect', callback=move)
                    util.line_index += 2

                while not util.game_over:
                    time.sleep(1)

                sio.disconnect()
        except Exception as e:
            print(f'Got exception of {e}')
            results[index][2] += 1


threads = []
results = []
redis_cli = redis.Redis(decode_responses=True)
redis_cli.flushdb()
start = time.time()

for n in range(NUM_PLAYERS):
    results.append([0, 0, 0])
    t = Thread(target=run_test, args=(results, n))
    t.start()
    threads.append(t)

# Wait all threads to finish.
for t in threads:
    t.join()

print(f"Total game testing lasted {time.time() - start} seconds")
print(f"************************************\n\n\n\n\n")
# assert that all went well
sum = 0
iter = 0
timeouts = 0
for result in results:
    print(f'Test #{iter} completed with {result[2]} errors, {result[1]} timeouts and {result[0]} completed games')
    iter += 1
    sum += result[0]
    timeouts += result[1]
print(f'Tests completed with {timeouts} timeouts and {sum}/{(NUM_PLAYERS * GAMES_PER_PLAYER)} completed games')
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
