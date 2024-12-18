import unittest
import socketio

from base_test_case import BaseTestCase


class AgreedDrawTestCase(BaseTestCase):

    draw = False

    def test_agreed_draw(self):

        sio = socketio.SimpleClient()
        sio.connect(url='http://localhost:5000/connect', namespace='/connect', transports=['websocket'])

        @sio.client.on('draw', namespace='/connect')
        def draw(data):
            # Assert we got back the move we're supposed to get
            print(f'Received draw offer {data}')
            if isinstance(data, dict) and not self.draw:
                self.draw = True
                sio.client.emit('/api/draw', {'data': {'sid': self.player_a_sid, 'flag': 1}}, namespace='/connect')

        @sio.client.on('game_over', namespace='/connect')
        def game_over(data):
            print(f"Received game_over {data}")
            self.assertEqual(data.get('winner'), 'Draw')
            self.assertEqual(data.get('message'), 'Draw By Agreement')
            self.assertEqual(len(self.seen_moves), 146)

            # Assert the state in redis at end of game
            game_id = self.redis_cli.hget(f'player_mapping_{self.player_a_sid}', 'game_id')
            self.assertEqual(self.redis_cli.llen(f'game_fens_{game_id}'), 146)
            self.assertEqual(self.redis_cli.llen(f'game_moves_{game_id}'), 146)
            self.assertEqual(self.redis_cli.hget(f'game_endgame_{game_id}', 'winner'), 'Draw')
            self.assertEqual(self.redis_cli.hget(f'game_endgame_{game_id}', 'message'), 'Draw By Agreement')

            game_mapping = self.redis_cli.hgetall(f'game_mapping_{game_id}')
            self.assertEqual(game_mapping.get('status'), "3")
            self.assertEqual(game_mapping.get('fen'), "8/8/8/p7/P2K4/6B1/4kP2/Q7 w - - 13 74")
            self.game_over = True

        def aux_func(sid):
            sio.client.emit('/api/draw', {'data': {'sid': self.player_b_sid, 'flag': "1"}},
                            namespace='/connect', callback=draw)

        self.base(sio, "partial", aux_func)
        self.assertTrue(self.draw)


if __name__ == '__main__':
    unittest.main()
