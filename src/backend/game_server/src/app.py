import chess
from flask import Flask, request
from flask_socketio import SocketIO, join_room
from engineio.payload import Payload

from game_server import GameServer, GameStatus, Result
from logger import get_logger
from player import Game, PlayerGameInfo, Player

from util import PlayerType


lgr = get_logger(path="/var/log/server.log")

app = Flask(__name__, template_folder='.')
app.config['SECRET_KEY'] = 'secret!'

socketio = SocketIO(app, cors_allowed_origins="*", manage_session=True)

Payload.max_decode_packets = 150

game_server = GameServer()


@app.route('/match/<sid1>/<sid2>')
def match(sid1, sid2):
    tc = request.json['time_control']
    player1 = game_server.get_player_session(sid1)
    if sid2 == '@':
        # no findings so we need to match with engine
        engine: Player = Player(rating=player1.rating, player_type=PlayerType.ENGINE.value)
        lgr.info(f"Matching player - {sid1} with engine {engine.sid}")
        game_server.set_player_session(engine)
        sid2 = engine.sid
    player2 = game_server.get_player_session(sid2)

    p1 = PlayerGameInfo(name=player1.name, rating=player1.rating, time_remaining=tc)
    p2 = PlayerGameInfo(name=player2.name, rating=player2.rating, time_remaining=tc)
    game_id = game_server.map_rivals(sid1, sid2, time_control=tc)
    Game(game_id=game_id, position=chess.Board().fen(), fens=[], moves=[],
                white=p1, black=p2, status=GameStatus.STARTED.value)
    lgr.info(f"Matched players - {sid1}, {sid2}")

    return 'OK'


@app.route('/healthcheck', methods=['GET'])
def healthcheck():
    return 'OK'


@app.route('/game_over', methods=['POST'])
def game_over():
    lgr.info(f"The request: {request.get_json()}")
    payload = request.get_json()
    lgr.info(f"Game over with content: {payload}")
    winner: str = payload.get('winner')
    loser: str = payload.get('loser')
    socketio.emit("game_over", payload.get('extra_data'), namespace='/connect', room=winner)
    socketio.emit("game_over", payload.get('extra_data'), namespace='/connect', room=loser)
    return 'OK'


@socketio.on('/api/cancelSearch', namespace='/connect')
def cancelSearch(payload):
    lgr.info(f"Cancelling search with payload {payload}")
    return game_server.cancel_search(payload)


# First connection of a player - returns the details of user as known by the server
@socketio.on('/api/play', namespace='/connect')
def play(payload):
    response = game_server.play(payload)
    join_room(room=response.dst_sid)
    if "game" in response.extra_data:
        the_dict = {'color': response.src_color, 'game': response.extra_data["game"]}
        connection = "game"
        socketio.emit(connection, the_dict, namespace='/connect', room=response.dst_sid)
    return response.dst_sid


@socketio.on('/api/heartbeat', namespace='/connect')
def heartbeat(payload):
    try:
        response = game_server.heartbeat(payload)
        join_room(response.dst_sid)
        if not response.extra_data:
            return {}
        elif "game" not in response.extra_data:
            return response.extra_data
        socketio.emit("game", {'color': response.src_color, 'game': response.extra_data["game"]}, namespace='/connect', room=response.dst_sid)
        return {}
    except Exception as e:
        lgr.error(f"Exception from heartbeat: {e}")
        return None


@socketio.on('/api/move', namespace='/connect')
def move(payload):
    send_to, data = game_server.move(payload)
    if send_to is None:     # quitting due to game over/bad move
        return
    origin_sid = data.pop('sid', None)
    socketio.emit("move", data, namespace='/connect', room=send_to)
    # send back to sender in case he has more than one page open
    socketio.emit("move", data, namespace='/connect', room=origin_sid)
    if "extra_data" in data:
        socketio.emit("game_over", data["extra_data"], namespace='/connect', room=send_to)
        # send back to sender to signal draw
        socketio.emit("game_over", data["extra_data"], namespace='/connect', room=origin_sid)
    return 'OK'


@socketio.on('/api/draw', namespace='/connect')
def draw(payload):
    response = game_server.draw(payload)
    if response is None:     # quitting due to game over/bad move
        return False
    if response.result == Result.DRAW_AGREED:       # draw by agreement
        socketio.emit("game_over", response.end_game_info.to_dict(), namespace='/connect', room=response.dst_sid)
        # send back to sender to signal draw
        socketio.emit("game_over", response.end_game_info.to_dict(), namespace='/connect', room=response.src_sid)
    else:
        response_dict = {"color": response.src_color, "flag": response.result.value}
        socketio.emit("draw", response_dict, namespace='/connect', room=response.dst_sid)
        # send back to sender in case he has more than one page open
        socketio.emit("draw", response_dict, namespace='/connect', room=response.src_sid)
    return True


@socketio.on('/api/rematch', namespace='/connect')
def rematch(payload):
    response = game_server.rematch(payload)
    if response is None:     # quitting due to game over/bad move
        return False
    else:
        socketio.emit("rematch", {"color": response.src_color, "flag": response.result.value}, namespace='/connect', room=response.dst_sid)
        # send back to sender in case he has more than one page open
        socketio.emit("rematch", {"color": response.src_color, "flag": response.result.value}, namespace='/connect', room=response.src_sid)
    return True


@socketio.on('/api/resign', namespace='/connect')
def resign(payload):
    server_response = game_server.resign(payload)
    if server_response is None:     # quitting due to game over/bad move
        return False
    send_to = server_response.dst_sid
    sender = server_response.src_sid
    if send_to is None:     # quitting due to game over/bad move
        return
    socketio.emit("game_over", server_response.end_game_info.to_dict(), namespace='/connect', room=send_to)
    # send back to sender in case he has more than one page open
    socketio.emit("game_over", server_response.end_game_info.to_dict(), namespace='/connect', room=sender)
    return True


@socketio.on('/api/abort', namespace='/connect')
def abort(payload: dict[str, dict[str, str]]):
    server_response = game_server.abort(payload)
    if server_response is None:
        # Illegal abort
        return None
    send_to = server_response.dst_sid
    sender = server_response.src_sid
    if send_to is None:     # quitting due to game over/bad move
        return None
    socketio.emit("game_over", server_response.end_game_info.to_dict(), namespace='/connect', room=send_to)
    # send back to sender in case he has more than one page open
    socketio.emit("game_over", server_response.end_game_info.to_dict(), namespace='/connect', room=sender)
    return True


if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', allow_unsafe_werkzeug=True)
