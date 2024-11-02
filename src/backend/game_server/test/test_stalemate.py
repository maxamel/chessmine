import json
import time
import unittest
import redis

import socketio
import threading

from src.backend.game_server.test.base_test_case import BaseTestCase


class StalemateTestCase(BaseTestCase):

    def test_stalemate(self):

        sio = socketio.SimpleClient()
        sio.connect(url='http://localhost:5000/connect', namespace='/connect')

        @sio.client.on('game_over', namespace='/connect')
        def game_over(data):
            print(f"Received game_over {data}")
            self.assertEqual(data.get('winner'), 'Draw')
            self.assertEqual(data.get('message'), 'Draw By Stalemate')
            self.assertEqual(len(self.seen_moves), 95)

            # Assert the state in redis at end of game
            game_id = self.redis_cli.hget(f'player_mapping_{self.player_a_sid}', 'game_id')
            self.assertEqual(self.redis_cli.llen(f'game_fens_{game_id}'), 95)
            self.assertEqual(self.redis_cli.llen(f'game_moves_{game_id}'), 95)
            self.assertEqual(self.redis_cli.hget(f'game_endgame_{game_id}', 'winner'), 'Draw')
            self.assertEqual(self.redis_cli.hget(f'game_endgame_{game_id}', 'message'), 'Draw By Stalemate')

            game_mapping = self.redis_cli.hgetall(f'game_mapping_{game_id}')
            self.assertEqual(game_mapping.get('status'), "3")
            self.assertEqual(game_mapping.get('fen'), "5R2/6k1/8/5Q2/1P3Q2/7P/5P2/6K1 b - - 2 48")
            self.game_over = True

        self.base(sio, "stalemate", lambda: None)


if __name__ == '__main__':
    unittest.main()
