import unittest
import socketio


from src.backend.game_server.test.base_test_case import BaseTestCase


class CheckmateTestCase(BaseTestCase):

    def test_checkmate(self):

        sio = socketio.SimpleClient()
        sio.connect(url='http://localhost:5000/connect', namespace='/connect')

        @sio.client.on('game_over', namespace='/connect')
        def game_over(data):
            print(f"Received game_over {data}")
            self.assertEqual(data.get('winner'), 'black')
            self.assertEqual(data.get('message'), 'white checkmated')
            self.assertEqual(len(self.seen_moves), 104)

            # Assert the state in redis at end of game
            game_id = self.redis_cli.hget(f'player_mapping_{self.player_a_sid}', 'game_id')
            self.assertEqual(self.redis_cli.llen(f'game_fens_{game_id}'), 104)
            self.assertEqual(self.redis_cli.llen(f'game_moves_{game_id}'), 104)
            self.assertEqual(self.redis_cli.hget(f'game_endgame_{game_id}', 'winner'), 'black')
            self.assertEqual(self.redis_cli.hget(f'game_endgame_{game_id}', 'message'), 'white checkmated')

            game_mapping = self.redis_cli.hgetall(f'game_mapping_{game_id}')
            self.assertEqual(game_mapping.get('status'), "3")
            self.assertEqual(game_mapping.get('fen'), "1R6/2P5/8/1p6/1k3p2/3P1np1/5r2/5K2 w - - 1 53")
            self.game_over = True

        self.base(sio, "checkmate", lambda: None)


if __name__ == '__main__':
    unittest.main()
