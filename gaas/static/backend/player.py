import pickle

from static.backend.consts import *
import json

class Player:
    def __init__(self, sid, name="Guest", rating=1500, preferences={}):
        self.sid = sid
        self.name = name
        self.rating = rating
        self.preferences = preferences

    def to_dict(self):
        return {
            "sid": self.sid,
            "name": self.name,
            "rating": self.rating,
            "preferences": self.preferences
        }

    @staticmethod
    def from_list(sid, L):
        return Player(sid=sid, name=L[NAME], rating=L[RATING], preferences=json.loads(L[PREFERENCES]))


class PlayerMapping:
    def __init__(self, sid, opponent=None, color=None, time_remaining=None,
                 turn_start_time=None, game_id=None, ttl_start_time=None):
        self.sid = sid
        self.opponent = opponent
        self.color = color
        self.time_remaining = time_remaining
        self.turn_start_time = turn_start_time
        self.game_id = game_id
        self.ttl_start_time = ttl_start_time

    def to_dict(self):
        return {
            "sid": self.sid,
            "opponent": self.opponent,
            "color": self.color,
            "time_remaining": self.time_remaining,
            "turn_start_time": self.turn_start_time,
            "game_id": self.game_id,
            "ttl_start_time": self.ttl_start_time
        }

    @staticmethod
    def from_dict(pd: dict):
        rem_time = pd[REMAINING_TIME]
        if rem_time != 'None':
            rem_time = int(rem_time)
        tst = pd[TURN_START_TIME]
        if tst != 'None':
            tst = int(tst)
        ttl = pd[TTL_START_TIME]
        if ttl != 'None':
            ttl = int(ttl)
        return PlayerMapping(sid=pd[SID], opponent=pd[OPPONENT], color=pd[COLOR], time_remaining=rem_time,
                             turn_start_time=tst, game_id=pd[GAME], ttl_start_time=ttl)


class Game:
    def __init__(self, game_id: str, position: str, moves: list, fens: list, white_remaining: int,
                 black_remaining: int, white: Player, black: Player, move_ttl: int = None):
        self.game_id = game_id
        self.position = position
        self.fens = fens
        self.moves = moves
        self.white_remaining = white_remaining
        self.black_remaining = black_remaining
        self.white = white
        self.black = black
        self.move_ttl = move_ttl

    def to_dict(self):
        return {
            "game_id": self.game_id,
            "position": self.position,
            "moves": json.dumps(self.moves),
            "fens": json.dumps(self.fens),
            "white_remaining": self.white_remaining,
            "black_remaining": self.black_remaining,
            "white": self.white.to_dict(),
            "black": self.black.to_dict(),
            "move_ttl": self.move_ttl
        }

