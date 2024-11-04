import unittest
import socketio

from base_test_case import BaseTestCase


class ResignTestCase(BaseTestCase):

    resign = False

    def test_resign(self):

        sio = socketio.SimpleClient()
        sio.connect(url='http://localhost:5000/connect', namespace='/connect', transports=['websocket'])

        @sio.client.on('resign', namespace='/connect')
        def resign(data):
            print(f'Received resign {data}')
            self.assertEqual(data, True)
            self.resign = True

        @sio.client.on('game_over', namespace='/connect')
        def game_over(data):
            print(f"Received game_over {data}")
            self.assertEqual(data.get('winner'), 'black')
            self.assertEqual(data.get('message'), 'white resigned')
            self.assertEqual(len(self.seen_moves), 146)

            # Assert the state in redis at end of game
            game_id = self.redis_cli.hget(f'player_mapping_{self.player_a_sid}', 'game_id')
            self.assertEqual(self.redis_cli.llen(f'game_fens_{game_id}'), 146)
            self.assertEqual(self.redis_cli.llen(f'game_moves_{game_id}'), 146)
            self.assertEqual(self.redis_cli.hget(f'game_endgame_{game_id}', 'winner'), 'black')
            self.assertEqual(self.redis_cli.hget(f'game_endgame_{game_id}', 'message'), 'white resigned')

            game_mapping = self.redis_cli.hgetall(f'game_mapping_{game_id}')
            self.assertEqual(game_mapping.get('status'), "3")
            self.assertEqual(game_mapping.get('fen'), "8/8/8/p7/P2K4/6B1/4kP2/Q7 w - - 13 74")
            self.game_over = True

        def aux_func(sid):
            sio.client.emit('/api/resign', {'data': {'sid': sid, 'flag': "1"}}, namespace='/connect', callback=resign)

        self.base(sio, "partial", aux_func)
        self.assertTrue(self.resign)


if __name__ == '__main__':
    unittest.main()
