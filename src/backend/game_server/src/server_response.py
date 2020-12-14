import json
from consts import *
from util import Result


class EndGameInfo:
    def __init__(self, message: str, white_rating: int, black_rating: int,
                 white_rating_delta: int, black_rating_delta: int, winner: str="-"):
        '''
        :param winner: color of winner
        :param message: message describing outcome, i.e. "black ran out of time"
        :param white_rating: new white rating
        :param black_rating: new black rating
        '''
        self.winner = winner
        self.message = message
        self.white_rating = white_rating
        self.black_rating = black_rating
        self.white_rating_delta = white_rating_delta
        self.black_rating_delta = black_rating_delta

    def to_dict(self):
        return {
            WINNER: self.winner,
            MESSAGE: self.message,
            WHITE_RATING: self.white_rating,
            BLACK_RATING: self.black_rating,
            WHITE_RATING_DELTA: self.white_rating_delta,
            BLACK_RATING_DELTA: self.black_rating_delta
        }

    @staticmethod
    def from_dict(d):
        white_rating = d[WHITE_RATING]
        if white_rating != 'None':
            white_rating = int(white_rating)
        black_rating = d[BLACK_RATING]
        if black_rating != 'None':
            black_rating = int(black_rating)
        white_rating_delta = d[WHITE_RATING_DELTA]
        if white_rating_delta != 'None':
            white_rating_delta = int(white_rating_delta)
        black_rating_delta = d[BLACK_RATING_DELTA]
        if black_rating_delta != 'None':
            black_rating_delta = int(black_rating_delta)
        return EndGameInfo(winner=d[WINNER], message=d[MESSAGE], white_rating=white_rating, black_rating=black_rating,
                           white_rating_delta=white_rating_delta, black_rating_delta=black_rating_delta)

class ServerResponse:
    def __init__(self, dst_sid: str, src_sid:str = None, src_color: str = None, dst_color: str = None,
                 result: Result = None, end_game_info: EndGameInfo = None, extra_data: dict = None):
        self.dst_sid = dst_sid
        self.src_sid = src_sid
        self.result = result
        self.src_color = src_color
        self.dst_color = dst_color
        self.end_game_info = end_game_info
        self.extra_data = extra_data

    def to_dict(self):
        egi = None
        if self.end_game_info is not None:
            egi = self.end_game_info.to_dict()
        result = None
        if self.result is not None:
            result = self.result.value
        return {
            DST_SID: self.dst_sid,
            SRC_SID: self.src_sid,
            RESULT: result,
            SRC_COLOR: self.src_color,
            DST_COLOR: self.dst_color,
            END_GAME_INFO: egi,
            EXTRA_DATA: json.dumps(self.extra_data)
        }

    @staticmethod
    def from_dict(d):
        egi = None
        if END_GAME_INFO in d:
            egi = EndGameInfo.from_dict(d[END_GAME_INFO])
        return ServerResponse(dst_sid=d[DST_SID],
                              src_sid=d[SRC_SID],
                              result=Result(d[RESULT]).name,
                              src_color=d[SRC_COLOR],
                              dst_color=d[DST_COLOR],
                              end_game_info=egi,
                              extra_data=json.loads(d[EXTRA_DATA]))
