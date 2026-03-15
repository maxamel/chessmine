import json
import time
import unittest
import socketio

from base_test_case import BaseTestCase


class InviteTestCase(BaseTestCase):
    """Extends BaseTestCase only so that running this module runs just test_invite (no test_checkmate).
    Uses a single connection: same socket emits invite (inviter) then invite (invitee)."""

    def _invite_callback(self, data):
        print(f"Received invite response: {data}")
        if not isinstance(data, dict):
            return
        # First call is inviter (we get waiting_id), second call is invitee
        if self.player_a_sid is None:
            extra = data.get('extra_data')
            if isinstance(extra, str):
                try:
                    extra = json.loads(extra)
                except json.JSONDecodeError:
                    extra = {}
            if isinstance(extra, dict) and extra.get('waiting_id'):
                self.waiting_id = extra['waiting_id']
            self.player_a_sid = data.get('dst_sid')
        else:
            self.player_b_sid = data.get('dst_sid')

    def _pre_game_invite(self, sio, game):
        sio.client.emit(
            event='/api/invite',
            data={'data': {'preferences': {'time_control': '1+0'}}},
            namespace='/connect',
            callback=self._invite_callback
        )
        time.sleep(5)
        self.assertIsNotNone(self.waiting_id, "waiting_id should be set after inviter /api/invite")
        self.assertIsNotNone(self.player_a_sid, "player_a_sid (inviter) should be set")

        sio.client.emit(
            event='/api/invite',
            data={'data': {'preferences': {'time_control': '1+0'}}, 'waiting_id': self.waiting_id},
            namespace='/connect',
            callback=self._invite_callback
        )
        time.sleep(5)
        self.assertIsNotNone(self.player_b_sid, "player_b_sid (invitee) should be set")

    def test_invite(self):
        sio = socketio.SimpleClient()
        sio.connect(url='http://localhost:5000/connect', namespace='/connect', transports=['websocket'])

        @sio.client.on('game_over', namespace='/connect')
        def game_over(data):
            print(f"Received game_over {data}")
            self.assertEqual(data.get('winner'), 'black')
            self.assertEqual(data.get('message'), 'white checkmated')
            self.assertEqual(len(self.seen_moves), 104)
            game_id = self.redis_cli.hget(f'player_mapping_{self.player_a_sid}', 'game_id')
            self.assertEqual(self.redis_cli.llen(f'game_fens_{game_id}'), 104)
            self.assertEqual(self.redis_cli.llen(f'game_moves_{game_id}'), 104)
            self.assertEqual(self.redis_cli.hget(f'game_endgame_{game_id}', 'winner'), 'black')
            self.assertEqual(
                self.redis_cli.hget(f'game_endgame_{game_id}', 'message'),
                'white checkmated'
            )
            game_mapping = self.redis_cli.hgetall(f'game_mapping_{game_id}')
            self.assertEqual(game_mapping.get('status'), "3")
            self.assertEqual(
                game_mapping.get('fen'),
                "1R6/2P5/8/1p6/1k3p2/3P1np1/5r2/5K2 w - - 1 53"
            )
            self.game_over = True

        self.base(sio, "checkmate", lambda x: None, pre_game_func=self._pre_game_invite)


if __name__ == '__main__':
    unittest.main()
