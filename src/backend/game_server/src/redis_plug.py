import os

import chess
import redis

from consts import *
from player import Player, PlayerMapping
from server_response import EndGameInfo
from util import GameStatus


class RedisPlug:

    def __init__(self):
        self.redis_url = os.getenv('REDIS_URL', "redis")
        self.redis_port = os.getenv('REDIS_PORT', "6379")
        self.search_pool = "search_pool"
        self.player_info = "player_session_"
        self.player = "player_mapping_"
        self.game = "game_mapping_"
        self.game_moves = "game_moves_"
        self.game_fens = "game_fens_"
        self.game_endgame = "game_endgame_"
        self.game_expire = "game_expirations"
        self.r = redis.Redis(host=self.redis_url, port=self.redis_port, db=0, decode_responses=True, retry_on_timeout=True)

    def add_players_to_search_pool(self, *player_sids):
        self.r.sadd(self.search_pool, *player_sids)

    def draw_player_from_search_pool(self) -> str:
        '''
        :return: sid of a random player
        '''
        return self.r.srandmember(self.search_pool)

    def remove_players_from_search_pool(self, *player_sids):
        '''
        :param player_sids: the players to remove from search pool
        :return: True if succeeded
        '''
        return self.r.srem(self.search_pool, *player_sids)

    def is_player_in_search_pool(self, player_sid):
        return self.r.sismember(self.search_pool, player_sid)

    def get_game_fen(self, game_id) -> str:
        key = self.game + game_id
        if not self.r.exists(key):
            return None
        return self.r.hget(key, FEN)

    def get_game_status(self, game_id) -> str:
        key = self.game + game_id
        if not self.r.exists(key):
            return None
        return int(self.r.hget(key, STATUS))

    def get_game_pgn(self, game_id) -> str:
        key = self.game + game_id
        if not self.r.exists(key):
            return None
        return self.r.hget(key, PGN)

    # Should be set when user first connects to store his info and cleared when heartbeats are unanswered
    def set_player_session(self, player: Player):
        key = self.player_info + player.sid
        self.r.hmset(key, player.to_dict())

    def get_player_session(self, sid):
        key = self.player_info + sid
        if not self.r.exists(key):
            return None
        session = self.r.hgetall(key)
        return Player.from_dict(session)

    def add_move_to_game(self, game_id, move):
        key = self.game_moves + game_id
        self.r.rpush(key, move)

    def add_fen_to_game(self, game_id, fen):
        key = self.game_fens + game_id
        self.r.rpush(key, fen)

    def get_game_moves(self, game_id) -> list:
        key = self.game_moves + game_id
        return self.r.lrange(key, 0, -1)

    def get_game_fens(self, game_id) -> list:
        key = self.game_fens + game_id
        return self.r.lrange(key, 0, -1)

    def set_game_fen(self, game_id, fen):
        key = self.game + game_id
        self.r.hset(key, FEN, fen)

    def set_game_endgame(self, game_id, end_game: EndGameInfo):
        key = self.game_endgame + game_id
        self.r.hmset(key, end_game.to_dict())

    def get_game_endgame(self, game_id):
        key = self.game_endgame + game_id
        if not self.r.exists(key):
            return None
        endgame = self.r.hgetall(key)
        return EndGameInfo.from_dict(endgame)

    def set_game_status(self, game_id, status: GameStatus):
        key = self.game + game_id
        self.r.hset(key, STATUS, status.value)

    def map_player(self, player, opponent, color, game_id, time_control=None, turn_start=None):
        key = self.player + player
        pm = PlayerMapping(sid=player, opponent=opponent, color=color, game_id=game_id,
                           time_remaining=time_control, turn_start_time=turn_start)
        self.r.hmset(key, pm.to_dict())
        self.r.expire(key, 3600)  # expire in an hour

    def set_player_session_value(self, player, key, val):
        session = self.player_info + player
        self.r.hset(session, key, val)

    def set_player_mapping_value(self, player, key, val):
        mapping = self.player + player
        self.r.hset(mapping, key, val)

    def get_player_mapping_value(self, player, key):
        mapping = self.player + player
        return self.r.hget(mapping, key)

    def is_game_mapping_exists(self, game) -> bool:
        key = self.game + game
        return self.r.exists(key)

    def is_player_mapping_exists(self, player) -> bool:
        key = self.player + player
        return self.r.exists(key)

    def is_player_session_exists(self, player) -> bool:
        key = self.player_info + player
        return self.r.exists(key)

    def get_player_mapping(self, player) -> PlayerMapping:
        key = self.player + player
        if not self.r.exists(key):
            return None
        mapping = self.r.hgetall(key)
        return PlayerMapping.from_dict(mapping)

    def set_game_timeout(self, game_id, timeout):
        key = self.game_expire
        self.r.zadd(key, {game_id: timeout})

    def peek_game_timeout(self):
        key = self.game_expire
        return self.r.zrange(key, 0, 1, withscores=True)

    def cancel_game_timeout(self, game_id):
        key = self.game_expire
        return self.r.zrem(key, game_id)

    def map_game(self, game_id, white_sid, black_sid, board=chess.Board().fen(), status=GameStatus.STARTED.value):
        key = self.game + game_id
        self.r.hmset(key, {FEN: board, WHITE: white_sid, BLACK: black_sid, STATUS: status})
        self.r.expire(key, 3600)  # expire in an hour

    def get_game(self, game_id):
        key = self.game + game_id
        the_game = self.r.hgetall(key)
        return the_game

    def remove_player_mapping(self, sid) -> dict:
        key = self.player + sid
        self.r.delete(key)

    def remove_game_info(self, game):
        mapping = self.game + game
        moves = self.game_moves + game
        fens = self.game_fens + game
        endgame = self.game_endgame + game
        self.r.delete(mapping)
        self.r.delete(moves)
        self.r.delete(fens)
        self.r.delete(endgame)

    def get_redis(self):
        return self.r
