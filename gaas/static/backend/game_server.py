import json, time, threading, chess, uuid, requests
from static.backend.player import Player, PlayerMapping
from static.backend.random_matcher import RandomMatcher
from static.backend.redis_plug import RedisPlug
from static.backend.consts import *

current_milli_time = lambda: int(round(time.time() * 1000))


class GameServer:

    def __init__(self):
        '''
        self.clients = {}
        self.games = []
        self.mapping_rival = {}
        self.mapping_time = {}
        self.mapping_remaining = {}
        self.board = chess.Board()
        '''
        self.timer = None
        self.redis = RedisPlug()
        self.matcher = RandomMatcher()

    def map_rivals(self, player1, player2, time_control):
        game_id = uuid.uuid4().hex
        self.redis.map_player(player=player1, opponent=player2, game_id=game_id, color=WHITE, time_control=time_control)
        self.redis.map_player(player=player2, opponent=player1, game_id=game_id, color=BLACK, time_control=time_control)
        self.redis.map_game(game_id=game_id)
        return game_id

    def get_game_fen_by_player_sid(self, sid):
        return self.redis.get_game_fen_by_player_sid(player=sid)

    def get_player_mapping(self, sid) -> PlayerMapping:
        return self.redis.get_player_mapping(sid)

    def set_player_session(self, player: Player) -> Player:
        self.redis.set_player_session(player=player)

    def get_player_session(self, sid) -> Player:
        return self.redis.get_player_session(sid)

    def get_player_from_cookie(self, cookie):
        if not cookie:
            sid = uuid.uuid4().hex
            player = Player(sid=sid)
        else:
            cookie = json.loads(cookie)
            sid = cookie["sid"]
            name = cookie["name"]
            rating = cookie["rating"]
            player = Player(sid=sid, name=name, rating=rating)

        return player

    def find_match(self, player):
        return self.matcher.match(player)

    def game_over(self, winner, msg):
        if self.timer is not None:
            self.timer.cancel()
        requests.get("http://localhost:5000/game_over/" + winner)

    def move(self, payload):
        if self.timer is not None:
            self.timer.cancel()
        print(payload)
        sid = payload["sid"]
        curr_time = current_milli_time()
        move = payload["move"]
        the_move = chess.Move.from_uci(move["from"] + move["to"])
        game_fen = self.redis.get_game_fen_by_player_sid(sid)
        if game_fen is None:
            board = chess.Board()
        else:
            board = chess.Board(game_fen)
        if not board.is_legal(the_move):
            print(the_move)
            raise ValueError("Illegal move captured!")
        board.push(the_move)
        self.redis.set_game_fen_by_player_sid(sid, board.fen())
        print(board)
        player_info = self.redis.get_player_mapping(sid)
        rival = player_info.opponent
        rival_info = self.redis.get_player_mapping(rival)
        if board.is_game_over():
            thread = threading.Thread(target=self.game_over, args=(rival, "Game Over",))
            thread.start()
        if player_info.turn_start_time != 'None':
            last_time = int(player_info.turn_start_time)
            elapsed = curr_time - last_time if last_time > 0 else 0
            payload["remaining"] = int(rival_info.time_remaining)
            payload["other_remaining"] = int(player_info.time_remaining) - elapsed
            self.timer = threading.Timer(payload["remaining"] / 1000, self.game_over, [rival, "Lost on time"])
            self.timer.start()
            self.redis.set_player_value(sid, REMAINING_TIME, payload["other_remaining"])
            self.redis.set_player_value(rival, TURN_START_TIME, curr_time)
        else:
            self.redis.set_player_value(sid, TURN_START_TIME, 0)
            self.redis.set_player_value(rival, TURN_START_TIME, 0)
            self.redis.set_player_value(sid, REMAINING_TIME, 300000)
            self.redis.set_player_value(rival, REMAINING_TIME, 300000)
        update = json.dumps(payload)
        print(update)
        return rival, update
