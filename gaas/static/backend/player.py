from static.backend.consts import *


class Player:
    def __init__(self, sid, name="Guest", rating=1500):
        self.sid = sid
        self.name = name
        self.rating = rating

    def to_dict(self):
        return {
            "sid": self.sid,
            "name": self.name,
            "rating": self.rating
        }

    @staticmethod
    def from_list(sid, L):
        return Player(sid=sid, name=L[NAME], rating=L[RATING])


class PlayerMapping:
    def __init__(self, sid, opponent=None, color=None, time_remaining=None, turn_start_time=None, game_id=None):
        self.sid = sid
        self.opponent = opponent
        self.color = color
        self.time_remaining = time_remaining
        self.turn_start_time = turn_start_time
        self.game_id = game_id

    def to_dict(self):
        return {
            "sid": self.sid,
            "opponent": self.opponent,
            "color": self.color,
            "time_remaining": self.time_remaining,
            "turn_start_time": self.turn_start_time,
            "game_id": self.game_id
        }

    @staticmethod
    def from_list(sid, L):
        tst = L[TURN_START_TIME]
        if L[TURN_START_TIME] != 'None':
            tst = int(L[TURN_START_TIME])
        tr = L[REMAINING_TIME]
        if L[REMAINING_TIME] != 'None':
            tr = int(L[REMAINING_TIME])
        return PlayerMapping(sid=sid, opponent=L[OPPONENT], color=L[COLOR], time_remaining=tr,
                             turn_start_time=tst, game_id=L[GAME])


class Game:
    def __init__(self, game_id: str, position: str, white_remaining: int, black_remaining: int, white: Player, black: Player):
        self.game_id = game_id
        self.position = position
        self.white_remaining = white_remaining
        self.black_remaining = black_remaining
        self.white = white
        self.black = black

    def to_dict(self):
        return {
            "game_id": self.game_id,
            "position": self.position,
            "white_remaining": self.white_remaining,
            "black_remaining": self.black_remaining,
            "white": self.white.to_dict(),
            "black": self.black.to_dict()
        }

