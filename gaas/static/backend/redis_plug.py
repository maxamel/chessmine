import chess
import redis

from static.backend.consts import *
from static.backend.player import Player, Game, PlayerMapping


class RedisPlug:

    def __init__(self):
        self.redis_url = "localhost"
        self.redis_port = "6379"
        self.search_pool = "search_pool"
        self.player_info = "player_session_"
        self.player = "player_mapping_"
        self.game = "game_"
        self.r = redis.Redis(host=self.redis_url, port=self.redis_port, db=0, decode_responses=True)

    def add_player_to_search_pool(self, player_sid):
        self.r.sadd(self.search_pool, player_sid)

    def draw_player_from_search_pool(self) -> str:
        '''
        :return: sid of a random player
        '''
        return self.r.srandmember(self.search_pool)

    def remove_players_from_search_pool(self, *player_sids):
        return self.r.srem(self.search_pool, *player_sids)

    def is_player_in_search_pool(self, player_sid):
        return self.r.sismember(self.search_pool, player_sid)

    def get_game_fen_by_player_sid(self, player) -> Game:
        key = self.player + player
        if not self.r.exists(key):
            return None
        game_id = self.r.lindex(key, GAME)
        return self.r.lindex(self.game + game_id, FEN)

    # Should be set when user first connects to store his info and cleared when heartbeats are unanswered
    def set_player_session(self, player: Player):
        key = self.player_info + player.sid
        self.r.rpush(key, player.name, player.rating)

    def get_player_session(self, sid):
        key = self.player_info + sid
        if not self.r.exists(key):
            return None
        session = self.r.lrange(key, 0, 1)
        return Player.from_list(sid, session)

    def set_game_fen_by_player_sid(self, player, fen):
        key = self.player + player
        game_id = self.r.lindex(key, GAME)
        return self.r.lset(self.game + game_id, FEN, fen)

    def map_player(self, player, opponent, color, game_id, time_control=None, turn_start=None):
        key = self.player + player
        self.r.rpush(key, opponent, color, time_control, turn_start, game_id)

    def set_player_value(self, player, index, val):
        key = self.player + player
        self.r.lset(key, index, val)

    def get_player_mapping(self, player) -> PlayerMapping:
        key = self.player + player
        if not self.r.exists(key):
            return None
        mapping = self.r.lrange(key, 0, GAME)
        return PlayerMapping.from_list(player, mapping)

    def map_game(self, game_id, board=chess.Board().fen()):
        key = self.game + game_id
        self.r.lpush(key, GAME, board)

    def get_redis(self):
        return self.r
