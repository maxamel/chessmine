import os

import chess
import redis

from consts import *
from player import Player, PlayerMapping
from server_response import EndGameInfo
from util import GameStatus
from redis.client import Pipeline, Redis


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
        self.redis = redis.Redis(host=self.redis_url, port=self.redis_port, db=0, decode_responses=True, retry_on_timeout=True)

    def add_players_to_search_pool(self, name: str, player_sids_to_ratings: dict[str, int]):
        return self.get_redis().zadd(name, player_sids_to_ratings)

    def draw_player_from_search_pool(self) -> str:
        '''
        :return: sid of a random player
        '''
        return self.get_redis().srandmember(self.search_pool)

    def remove_players_from_search_pool(self, name, *player_sids):
        '''
        :param player_sids: the players to remove from search pool
        :param search_pool: the name of search pool to remove players from
        :return: 1 if succeeded
        '''
        return self.get_redis().zrem(name, *player_sids)

    def is_player_in_search_pool(self, player_sid):
        return self.get_redis().sismember(self.search_pool, player_sid)

    def get_game_fen(self, game_id) -> str:
        key = self.game + game_id
        if not self.get_redis().exists(key):
            return None
        return self.get_redis().hget(key, FEN)

    def get_game_status(self, game_id) -> str:
        key = self.game + game_id
        if not self.get_redis().exists(key):
            return None
        return int(self.get_redis().hget(key, STATUS))

    def get_game_pgn(self, game_id) -> str:
        key = self.game + game_id
        if not self.get_redis().exists(key):
            return None
        return self.get_redis().hget(key, PGN)

    # Should be set when user first connects to store his info and cleared when heartbeats are unanswered
    def set_player_session(self, player: Player, pipeline: Pipeline = None):
        key = self.player_info + player.sid
        self.get_redis(pipeline).hmset(key, player.to_dict())
        self.get_redis(pipeline).expire(key, 86400)  # expire in one day

    def get_player_session(self, sid, pipeline: Pipeline = None):
        key = self.player_info + sid
        session = self.get_redis(pipeline).hgetall(key)
        if not pipeline and session:
            return Player.from_dict(session)
        return None

    def add_move_to_game(self, game_id, move, pipeline: Pipeline = None):
        key = self.game_moves + game_id
        self.get_redis(pipeline).rpush(key, move)
        self.get_redis(pipeline).expire(key, 3600)  # expire in one hour

    def add_fen_to_game(self, game_id, fen, pipeline: Pipeline = None):
        key = self.game_fens + game_id
        self.get_redis(pipeline).rpush(key, fen)
        self.get_redis(pipeline).expire(key, 3600)  # expire in one hour

    def get_game_moves(self, game_id) -> list:
        key = self.game_moves + game_id
        return self.get_redis().lrange(key, 0, -1)

    def get_game_fens(self, game_id) -> list:
        key = self.game_fens + game_id
        return self.get_redis().lrange(key, 0, -1)

    def set_game_fen(self, game_id, fen, pipeline: Pipeline = None):
        key = self.game + game_id
        self.get_redis(pipeline).hset(key, FEN, fen)

    def set_game_endgame(self, game_id, end_game: EndGameInfo, pipeline: Pipeline = None):
        key = self.game_endgame + game_id
        self.get_redis(pipeline).hmset(key, end_game.to_dict())

    def get_game_endgame(self, game_id):
        key = self.game_endgame + game_id
        if not self.get_redis().exists(key):
            return None
        endgame = self.get_redis().hgetall(key)
        return EndGameInfo.from_dict(endgame)

    def set_game_status(self, game_id, status: GameStatus, pipeline: Pipeline = None):
        key = self.game + game_id
        self.get_redis(pipeline).hset(key, STATUS, status.value)

    def set_player_mapping(self, player, opponent, color, game_id, time_control=None, turn_start=None, pipeline: Pipeline = None):
        key = self.player + player
        pm = PlayerMapping(sid=player, opponent=opponent, color=color, game_id=game_id,
                           time_remaining=time_control, turn_start_time=turn_start)
        self.get_redis(pipeline).hmset(key, pm.to_dict())
        self.get_redis(pipeline).expire(key, 3600)  # expire in one hour

    def set_player_session_value(self, player, key, val, pipeline: Pipeline = None):
        session = self.player_info + player
        self.get_redis(pipeline).hset(session, key, val)

    def set_player_mapping_value(self, player, key, val, pipeline: Pipeline = None):
        mapping = self.player + player
        self.get_redis(pipeline).hset(mapping, key, val)

    def get_player_mapping_value(self, player, key):
        mapping = self.player + player
        return self.get_redis().hget(mapping, key)

    def is_game_mapping_exists(self, game) -> bool:
        key = self.game + game
        return self.get_redis().exists(key)

    def is_player_mapping_exists(self, player) -> bool:
        key = self.player + player
        return self.get_redis().exists(key)

    def is_player_session_exists(self, player) -> bool:
        key = self.player_info + player
        return self.get_redis().exists(key)

    def get_player_mapping(self, player) -> PlayerMapping:
        key = self.player + player
        if not self.get_redis().exists(key):
            return None
        mapping = self.get_redis().hgetall(key)
        return PlayerMapping.from_dict(mapping)

    def set_game_timeout(self, game_id, timeout, pipeline: Pipeline = None):
        key = self.game_expire
        self.get_redis(pipeline).zadd(key, {game_id: timeout})

    def peek_game_timeout(self):
        key = self.game_expire
        return self.get_redis().zrange(key, 0, 1, withscores=True)

    def cancel_game_timeout(self, game_id, pipeline: Pipeline = None):
        key = self.game_expire
        return self.get_redis(pipeline).zrem(key, game_id)

    def set_game_mapping(self, game_id, white_sid, black_sid, board=chess.Board().fen(),
                         status=GameStatus.STARTED.value, pipeline: Pipeline = None):
        key = self.game + game_id
        self.get_redis(pipeline).hmset(key, {FEN: board, WHITE: white_sid, BLACK: black_sid, STATUS: status})
        self.get_redis(pipeline).expire(key, 3600)  # expire in an hour

    def get_game(self, game_id):
        key = self.game + game_id
        the_game = self.get_redis().hgetall(key)
        return the_game

    def remove_player_mapping(self, sid) -> dict:
        key = self.player + sid
        self.get_redis().delete(key)

    def remove_game_info(self, game, pipeline: Pipeline = None):
        mapping = self.game + game
        moves = self.game_moves + game
        fens = self.game_fens + game
        endgame = self.game_endgame + game
        self.get_redis(pipeline).delete(mapping)
        self.get_redis(pipeline).delete(moves)
        self.get_redis(pipeline).delete(fens)
        self.get_redis(pipeline).delete(endgame)

    def register_script(self, script: str):
        return self.get_redis().register_script(script)

    def get_pipeline(self) -> Pipeline:
        return self.get_redis().pipeline()

    def get_redis(self, pipeline: Pipeline = None) -> Redis:
        return pipeline or self.redis
