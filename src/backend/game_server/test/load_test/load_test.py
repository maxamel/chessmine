from threading import Thread

import json
import time
import redis

import socketio

from report import Report

COMPLETED = 0
TIMEOUT = 1
ERROR = 2
ABORTED = 3
TIMERUNOUT = 4

LOGGER = None


def run_test(results: list, index: int, games_per_player: int, endpoint: str, redis_host: str, redis_port: int):
    LOGGER.info(f"Running test number {index}")
    start = time.time()
    test(results, index, games_per_player, endpoint, redis_host, redis_port)
    LOGGER.info(f"Test #{index} lasted {time.time() - start} seconds")


class UtilityHelper:

    def __init__(self, redis_host: str, redis_port: int):
        self.player_sid = None
        self.line_index = 0
        self.color = 'w'
        self.ready = False
        self.seen_moves = set()
        self.last_heartbeat = None
        self.redis_cli = redis.Redis(redis_host, redis_port, decode_responses=True)
        self.game_over = False


def test(results: list, index: int, games_per_player: int, endpoint: str, redis_host: str, redis_port: int):

    for i in range(games_per_player):
        try:
            with socketio.SimpleClient(logger=False, engineio_logger=False) as sio:

                util = UtilityHelper(redis_host, redis_port)

                sio.connect(url=endpoint, namespace='/connect', transports=['websocket'])
                f = open('../resources/checkmate.json', 'r')
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
                        #LOGGER.debug(f'Got move for sid {util.player_sid} and payload: {data}')
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
                                LOGGER.error(f'Connection error {exc.__class__.__name__} while sending move: '
                                              f'{json.loads(lines[util.line_index])} for sid {util.player_sid}')
                                # retry without the timeout limit in case the move wasn't registered
                                sio.client.call('/api/move',
                                                {'sid': util.player_sid, 'move': json.loads(lines[util.line_index])},
                                                namespace='/connect')
                            util.line_index += 2

                @sio.client.on('game_over', namespace='/connect')
                def game_over(data):
                    LOGGER.info(f"Received game_over {data} for sid {util.player_sid}")
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
            LOGGER.error(f'Got exception of {e}')
            results[index][ERROR] += 1


def main(player_count, logger, games_per_player=1, endpoint="https://www.chessmine.xyz/",
         redis_host="localhost", redis_port=6379) -> Report:
    global LOGGER
    LOGGER = logger
    threads = []
    results = []
    redis_cli = redis.Redis(host=redis_host, port=redis_port, decode_responses=True)
    redis_cli.flushdb()
    start = time.time()

    for n in range(player_count):
        results.append([0, 0, 0, 0, 0])
        t = Thread(target=run_test, args=(results, n, games_per_player, endpoint, redis_host, redis_port))
        t.start()
        threads.append(t)

    # Wait for all threads to finish.
    for t in threads:
        t.join(300)     # 5 min. timeout

    end = time.time()

    # assert that all went well
    completed = 0
    iter = 0
    timeouts = 0
    errors = 0
    aborts = 0
    timerunouts = 0
    success = True

    for result in results:
        LOGGER.info(f'Test #{iter} completed with {result[ERROR]} errors, {result[TIMEOUT]} timeouts and {result[COMPLETED]} completed games')
        iter += 1
        completed += result[COMPLETED]
        timeouts += result[TIMEOUT]
        errors += result[ERROR]
        aborts += result[ABORTED]
        timerunouts += result[TIMERUNOUT]

    games_planned = int((player_count * games_per_player) / 2)
    games_played = int(completed / 2)

    success_rate = float("{:.2f}".format(100 * (completed/(player_count * games_per_player))))
    throughput = float("{:.3f}".format(games_planned/(end - start)))
    LOGGER.info(f"************************************\n\n\n")
    LOGGER.info(f"Total game testing lasted {end - start} seconds")
    LOGGER.info(f"************************************\n")
    LOGGER.info(f'Tests completed with {timeouts} timeouts, {errors} errors, {aborts} aborts, {timerunouts} timerunouts and {games_played}/{games_planned} completed games')
    LOGGER.info(f"************************************\n")
    LOGGER.info(f'Games completed: {games_played} completed games with {success_rate}% success rate')
    LOGGER.info(f"************************************\n")
    LOGGER.info(f'Game throughput: {throughput}')
    LOGGER.info(f"************************************\n\n\n")

    success = success and completed == (player_count * games_per_player)

    games = redis_cli.keys("game_mapping_*")
    success = success and len(games) == games_planned

    endgames = redis_cli.keys("game_endgame_*")
    success = success and len(endgames) == games_planned

    sessions = redis_cli.keys("player_session_*")
    success = success and len(sessions) == player_count * games_per_player

    mappings = redis_cli.keys("player_mapping_*")
    success = success and len(mappings) == player_count * games_per_player

    players = set()
    for game in games:
        game_mapping = redis_cli.hgetall(game)
        players.add(game_mapping.get('white'))
        players.add(game_mapping.get('black'))
    success = success and len(players) == player_count * games_per_player

    return Report(test_duration=end - start, throughput=throughput, games_played=games_played, games_planned=games_planned,
                  timeouts=timeouts, aborts=aborts, success=success, errors=errors, timerunouts=timerunouts)
