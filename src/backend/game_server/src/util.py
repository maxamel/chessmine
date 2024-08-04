from enum import Enum

import chess

from consts import WHITE, BLACK


def get_turn_from_fen(fen: str) -> str:
    array = fen.split()
    if array[1] == 'w':
        return WHITE
    return BLACK

def get_millis_for_time_control(time_control: str) -> int:
    array = time_control.split('+')
    mins = int(array[0])
    return mins*1000*60

def get_opposite_color(color: str):
    if color == BLACK:
        return WHITE
    if color == WHITE:
        return BLACK

def piece_symbol_to_obj(param):
    if param == 'p':
        return chess.PAWN
    if param == 'n':
        return chess.KNIGHT
    if param == 'b':
        return chess.BISHOP
    if param == 'r':
        return chess.ROOK
    if param == 'q':
        return chess.QUEEN


class GameStatus(Enum):
    STARTED = 1
    PLAYING = 2
    ENDED = 3

class ConnectStatus(Enum):
    CONNECTING = 1
    CONNECTED = 2
    DISCONNECTED = 3

class Result(Enum):
    DRAW_OFFERED = 1
    DRAW_AGREED = 2
    DRAW_DECLINED = 3

    REMATCH_OFFERED = 4
    REMATCH_AGREED = 5
    REMATCH_DECLINED = 6

    RESIGN = 7
    ABORT = 8
    GAME_IN_PROGRESS = 9
    GAME_STARTED = 10
    GAME_ENDED = 11

class Outcome(Enum):
    FIRST_PLAYER_WINS = 1
    SECOND_PLAYER_WINS = 2
    DRAW = 0
    NO_GAME = 3