import json
import time
import unittest
import redis

import socketio
import threading


class MyTestCase(unittest.TestCase):
    player_a_sid = None
    player_b_sid = None
    last_move_made = None
    game_over = False
    seen_moves = set()
    lock = threading.Lock()                     # for internal locking of move method so every time a single move is processed
    semaphore = threading.BoundedSemaphore(1)   # for correlating between sending moves and receiving
    redis_cli = redis.Redis(decode_responses=True)

    def test_threefold(self):

        with socketio.SimpleClient() as sio:

            sio.connect(url='http://localhost:5000/connect', namespace='/connect')

            @sio.client.on('move', namespace='/connect')
            def move(data):
                # Assert we got back the move we're supposed to get
                if isinstance(data, dict):
                    move_hash = hash(json.dumps(data.get('move')))
                    self.lock.acquire()
                    if move_hash not in self.seen_moves:
                        print(f"Received new move {data}")
                        self.assertEqual(data.get('move'), self.last_move_made)
                        self.seen_moves.add(move_hash)
                        self.semaphore.release()  # allow next move to be sent
                    self.lock.release()

            @sio.client.on('game_over', namespace='/connect')
            def game_over(data):
                print(f"Received game_over {data}")
                self.assertEqual(data.get('winner'), 'Draw')
                self.assertEqual(data.get('message'), 'Draw By Three-Fold Repetition')
                self.assertEqual(len(self.seen_moves), 148)

                # Assert the state in redis at end of game
                game_id = self.redis_cli.hget(f'player_mapping_{self.player_a_sid}', 'game_id')
                self.assertEqual(self.redis_cli.llen(f'game_fens_{game_id}'), 148)
                self.assertEqual(self.redis_cli.llen(f'game_moves_{game_id}'), 148)
                self.assertEqual(self.redis_cli.hget(f'game_endgame_{game_id}', 'winner'), 'Draw')
                self.assertEqual(self.redis_cli.hget(f'game_endgame_{game_id}', 'message'), 'Draw By Three-Fold Repetition')

                game_mapping = self.redis_cli.hgetall(f'game_mapping_{game_id}')
                self.assertEqual(game_mapping.get('status'), "3")
                self.assertEqual(game_mapping.get('fen'), "8/8/8/p7/P3K3/6B1/3k1P2/Q7 w - - 15 75")
                self.game_over = True

            @sio.client.on('game', namespace='/connect')
            def game(data):
                print(f"Received game data: {data}")
                if isinstance(data, str):
                    if self.player_a_sid is None:
                        self.player_a_sid = data
                    elif self.player_b_sid is None:
                        self.player_b_sid = data

            sio.client.emit(event='/api/play', data={'data': {'preferences': {'time_control': '5+0', }}},
                            namespace='/connect', callback=game)
            sio.client.emit(event='/api/play', data={'data': {'preferences': {'time_control': '5+0', }}},
                            namespace='/connect', callback=game)

            # Allow time for matching
            time.sleep(10)

            self.assertIsNotNone(self.player_a_sid)
            self.assertIsNotNone(self.player_b_sid)
            # assert game mappings
            game_id = self.redis_cli.hget(f'player_mapping_{self.player_a_sid}', 'game_id')
            game_mapping = self.redis_cli.hgetall(f'game_mapping_{game_id}')
            self.assertEqual(game_mapping.get('status'), "1")
            self.assertEqual(game_mapping.get('fen'), "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1")
            self.assertIn(game_mapping.get('white'), [self.player_a_sid, self.player_b_sid])
            self.assertIn(game_mapping.get('black'), [self.player_a_sid, self.player_b_sid])

            # assert player mappings
            player_a_mapping = self.redis_cli.hgetall(f'player_mapping_{self.player_a_sid}')
            self.assertEqual(player_a_mapping.get('sid'), self.player_a_sid)
            self.assertEqual(player_a_mapping.get('opponent'), self.player_b_sid)
            self.assertEqual(player_a_mapping.get('game_id'), game_id)

            player_b_mapping = self.redis_cli.hgetall(f'player_mapping_{self.player_b_sid}')
            self.assertEqual(player_b_mapping.get('sid'), self.player_b_sid)
            self.assertEqual(player_b_mapping.get('opponent'), self.player_a_sid)
            self.assertEqual(player_b_mapping.get('game_id'), game_id)

            # assert player sessions
            player_a_session = self.redis_cli.hgetall(f'player_session_{self.player_a_sid}')
            self.assertEqual(player_a_session.get('sid'), self.player_a_sid)
            self.assertEqual(player_a_session.get('player_type'), "0")
            self.assertEqual(player_a_session.get('name'), "Guest")
            self.assertEqual(player_a_session.get('rating'), "1500")
            self.assertEqual(player_a_session.get('preferences'), "{\"time_control\": \"5+0\"}")

            player_b_session = self.redis_cli.hgetall(f'player_session_{self.player_b_sid}')
            self.assertEqual(player_b_session.get('sid'), self.player_b_sid)
            self.assertEqual(player_b_session.get('player_type'), "0")
            self.assertEqual(player_b_session.get('name'), "Guest")
            self.assertEqual(player_b_session.get('rating'), "1500")
            self.assertEqual(player_b_session.get('preferences'), "{\"time_control\": \"5+0\"}")

            white_sid = game_mapping.get('white')
            f = open('resources/threefold.json', 'r')
            lines = tuple(f)
            current_sid = white_sid
            for line in lines:
                self.semaphore.acquire(timeout=5)
                sio.client.emit('/api/move', {'sid': current_sid, 'move': json.loads(line)},
                                namespace='/connect', callback=move)
                self.last_move_made = json.loads(line)
                if current_sid != self.player_b_sid:
                    current_sid = self.player_b_sid
                else:
                    current_sid = self.player_a_sid
            f.close()

            time.sleep(5)
            self.assertTrue(self.game_over)
            sio.disconnect()


if __name__ == '__main__':
    unittest.main()
