import json
import time
import unittest
import redis

import threading

import socketio


class ExpiryTestCase(unittest.TestCase):

    def __init__(self, method_name='runTest'):
        super(ExpiryTestCase, self).__init__(method_name)
        self.last_move_made = None
        self.game_over = False
        self.seen_moves = set()
        self.lock = threading.Lock()  # for internal locking of move method so every time a single move is processed
        self.semaphore = threading.BoundedSemaphore(1)  # for correlating between sending moves and receiving
        self.redis_cli = redis.Redis(decode_responses=True)
        self.sid_set = set()

    def test_expiry_load(self):

        self.redis_cli.flushall()
        sio = socketio.SimpleClient()
        sio.connect(url='http://localhost:5000/connect', namespace='/connect', transports=['websocket'])

        @sio.client.on('game', namespace='/connect')
        def game(data):
            if len(self.sid_set) % 100 == 0:
                print(f"Received game data number #{len(self.sid_set)}: {data}")
            self.sid_set.add(data)

        game_amount = 1000
        for i in range(game_amount*2):
            sio.client.emit(event='/api/play', data={'data': {'preferences': {'time_control': '1+0', }}},
                            namespace='/connect', callback=game)

        # Allow time for matching
        f = open(f'resources/checkmate.json', 'r')
        lines = tuple(f)
        f.close()
        # assert game mappings

        start = time.time()
        break_time = 150
        while len(self.redis_cli.keys("game_mapping_*")) < game_amount and time.time() - start < break_time:
            time.sleep(1)
        end = time.time()

        mappings = self.redis_cli.keys("game_mapping_*")
        print(f'broke out of first waiting loop with {len(mappings)} game mappings after {end - start} seconds')
        self.assertTrue(end - start < 40)

        # emit first move for each game
        for mapping in mappings:
            white_sid = self.redis_cli.hget(mapping, 'white')
            sio.client.emit('/api/move', {'sid': white_sid, 'move': json.loads(lines[0])}, namespace='/connect')
        time.sleep(10)

        start = time.time()
        break_time = 150
        while self.redis_cli.zcard('game_expirations') > 0 and time.time() - start < break_time:
            time.sleep(1)
        end = time.time()

        exps = self.redis_cli.zcard('game_expirations')
        print(f'broke out of second waiting loop with {exps} expirations after {end - start} seconds')
        self.assertTrue(end - start < 40)

        self.assertTrue(self.redis_cli.zcard('game_expirations') == 0)
        self.assertTrue(len(self.redis_cli.keys("game_mapping_*")) == game_amount)

        sio.disconnect()
        self.redis_cli.flushall()
