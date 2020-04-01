from static.backend.consts import WHITE, BLACK


def get_turn_from_fen(fen: str) -> str:
    array = fen.split()
    if array[1] == 'w':
        return WHITE
    return BLACK
