import os
import unittest
import socketio


from base_test_case import BaseTestCase


class CheckmateTestCase(BaseTestCase):

    def test_checkmate(self):
        game_server_url = os.environ.get("GAME_SERVER_URL", "http://localhost:5000")
        sio = socketio.SimpleClient()
        sio.connect(url=f'{game_server_url}/connect', namespace='/connect', transports=['websocket'])

        @sio.client.on('game_over', namespace='/connect')
        def game_over(data):
            print(f"Received game_over {data}")
            self.assertEqual(data.get('winner'), 'black')
            self.assertEqual(data.get('message'), 'white checkmated')
            self.assertEqual(len(self.seen_moves), 104)

            # Assert the state in redis at end of game
            time_remaining_a = self.redis_cli.hget(f'player_mapping_{self.player_a_sid}', 'time_remaining')
            time_remaining_b = self.redis_cli.hget(f'player_mapping_{self.player_b_sid}', 'time_remaining')
            self.assertLess(int(time_remaining_a), 60000)
            self.assertLess(int(time_remaining_b), 60000)
            game_id = self.redis_cli.hget(f'player_mapping_{self.player_a_sid}', 'game_id')
            self.assertEqual(self.redis_cli.llen(f'game_fens_{game_id}'), 104)
            self.assertEqual(self.redis_cli.llen(f'game_moves_{game_id}'), 104)
            self.assertEqual(self.redis_cli.hget(f'game_endgame_{game_id}', 'winner'), 'black')
            self.assertEqual(self.redis_cli.hget(f'game_endgame_{game_id}', 'message'), 'white checkmated')

            game_mapping = self.redis_cli.hgetall(f'game_mapping_{game_id}')
            self.assertEqual(game_mapping.get('status'), "3")
            self.assertEqual(game_mapping.get('fen'), "1R6/2P5/8/1p6/1k3p2/3P1np1/5r2/5K2 w - - 1 53")
            self.game_over = True

        self.base(sio, "checkmate", lambda x: None)


if __name__ == '__main__':
    unittest.main()
