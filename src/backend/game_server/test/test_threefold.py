import unittest
import socketio


from base_test_case import BaseTestCase


class ThreeFoldTestCase(BaseTestCase):

    def test_threefold(self):

        sio = socketio.SimpleClient()
        sio.connect(url='http://localhost:5000/connect', namespace='/connect', transports=['websocket'])

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

        self.base(sio, "threefold", lambda x: None)


if __name__ == '__main__':
    unittest.main()
