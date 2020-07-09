
from static.backend.consts import *
import json, uuid

from static.backend.server_response import EndGameInfo


class Player:
    def __init__(self, sid=None, name="Guest", rating=1500, preferences={}):
        if sid is None:
            sid = uuid.uuid4().hex
        self.sid = sid
        self.name = name
        self.rating = rating
        self.preferences = preferences

    def to_dict(self):
        return {
            "sid": self.sid,
            "name": self.name,
            "rating": self.rating,
            "preferences": json.dumps(self.preferences)
        }

    @staticmethod
    def from_dict(d):
        rating = d[RATING]
        if rating != 'None':
            rating = int(rating)
        return Player(sid=d[SID], name=d[NAME], rating=rating, preferences=json.loads(d[PREFERENCES]))

class PlayerGameInfo:
    def __init__(self, name="Guest", rating=1500, rating_delta=None, time_remaining=None, connect_status=None):
        self.name = name
        self.rating = rating
        self.rating_delta = rating_delta
        self.time_remaining = time_remaining
        self.connect_status = connect_status

    def to_dict(self):
        return {
            NAME: self.name,
            RATING: self.rating,
            RATING_DELTA: self.rating_delta,
            REMAINING_TIME: self.time_remaining,
            CONNECT_STATUS: self.connect_status
        }

    @staticmethod
    def from_dict(d):
        rm_time = d[REMAINING_TIME]
        if rm_time != 'None':
            rm_time = int(rm_time)
        rating = d[RATING]
        if rating != 'None':
            rating = int(rating)
        rating_delta = d[RATING_DELTA]
        if rating_delta != 'None':
            rating_delta = int(rating_delta)
        return PlayerGameInfo(name=d[NAME], rating=rating, rating_delta=rating_delta,
                              time_remaining=rm_time, connect_status=d[CONNECT_STATUS])

class PlayerMapping:
    def __init__(self, sid, opponent=None, color=None, time_remaining=None,
                 turn_start_time=None, game_id=None, ttl_start_time=None, draw_offer=0,
                 rematch_offer=0, last_seen=None):
        self.sid = sid
        self.opponent = opponent
        self.color = color
        self.time_remaining = time_remaining
        self.turn_start_time = turn_start_time
        self.game_id = game_id
        self.ttl_start_time = ttl_start_time
        self.draw_offer = draw_offer
        self.rematch_offer = rematch_offer
        self.last_seen = last_seen

    def to_dict(self):
        return {
            "sid": self.sid,
            "opponent": self.opponent,
            "color": self.color,
            "time_remaining": self.time_remaining,
            "turn_start_time": self.turn_start_time,
            "game_id": self.game_id,
            "ttl_start_time": self.ttl_start_time,
            "draw_offer": self.draw_offer,
            "rematch_offer": self.rematch_offer,
            "last_seen": self.last_seen
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
        draw = pd[DRAW_OFFER]
        if draw != 'None':
            draw = int(draw)
        rematch = pd[REMATCH_OFFER]
        if rematch != 'None':
            rematch = int(rematch)
        lst = pd[LAST_SEEN]
        if lst != 'None':
            lst = int(lst)
        return PlayerMapping(sid=pd[SID], opponent=pd[OPPONENT], color=pd[COLOR], time_remaining=rem_time,
                             turn_start_time=tst, game_id=pd[GAME], ttl_start_time=ttl, draw_offer=draw,
                             rematch_offer=rematch, last_seen=lst)


class Game:
    def __init__(self, game_id: str, position: str, moves: list, fens: list, white: PlayerGameInfo, black: PlayerGameInfo,
                 move_ttl: int = None, draw_offer = None, rematch_offer = None, status = None, end_game_info: EndGameInfo = None):
        self.game_id = game_id
        self.position = position
        self.fens = fens
        self.moves = moves
        self.white = white
        self.black = black
        self.move_ttl = move_ttl
        self.draw_offer = draw_offer
        self.rematch_offer = rematch_offer
        self.status = status
        self.end_game_info = end_game_info

    def to_dict(self):
        return {
            "game_id": self.game_id,
            "position": self.position,
            "moves": json.dumps(self.moves),
            "fens": json.dumps(self.fens),
            "white": self.white.to_dict(),
            "black": self.black.to_dict(),
            "move_ttl": self.move_ttl,
            "draw_offer": self.draw_offer,
            "rematch_offer": self.rematch_offer,
            "status": self.status,
            "end_game_info": None if self.end_game_info is None else self.end_game_info.to_dict()
        }
