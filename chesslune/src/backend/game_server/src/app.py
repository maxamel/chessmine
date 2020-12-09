import chess
import requests
from flask import Flask, render_template, request, jsonify, url_for
from flask_socketio import SocketIO, join_room
from engineio.payload import Payload

from game_server import GameServer
from player import Game, PlayerGameInfo
from authlib.integrations.flask_client import OAuth

from game_server import get_opposite_color, GameStatus, Result

app = Flask(__name__, template_folder='.')
app.config['SECRET_KEY'] = 'secret!'
socketio = SocketIO(app, cors_allowed_origins="*", manage_session=True)
oauth = OAuth(app)
oauth.register('lichess')

Payload.max_decode_packets = 150

game_server = GameServer()


@app.route('/match/<sid1>/<sid2>')
def match(sid1, sid2):
    tc = request.json['time_control']
    player1 = game_server.get_player_session(sid1)
    player2 = game_server.get_player_session(sid2)

    p1 = PlayerGameInfo(name=player1.name, rating=player1.rating, time_remaining=tc)
    p2 = PlayerGameInfo(name=player2.name, rating=player2.rating, time_remaining=tc)
    game_id = game_server.map_rivals(sid1, sid2, time_control=tc)
    game = Game(game_id=game_id, position=chess.Board().fen(), fens=[], moves=[],
                white=p1, black=p2, status=GameStatus.STARTED.value)
    print("Got match - %s %s", sid1, sid2)
    '''
    socketio.emit("game", {'color': WHITE, 'game': game.to_dict()},
                  namespace='/connect', room=sid1)
    socketio.emit("game", {'color': BLACK, 'game': game.to_dict()},
                  namespace='/connect', room=sid2)
    '''
    return 'OK'


@app.route('/game_over/<winner>')
def game_over(winner):
    socketio.emit("game_over", {'winner': winner, 'message': get_opposite_color(winner) + " ran out of time"}, namespace='/connect')
    #socketio.emit("game_over", {'winner': winner, 'message': get_opposite_color(winner) + " ran out of time"}, namespace='/connect')
    return 'OK'


@app.route('/login')
def login():
    redirect_uri = url_for('authorize', _external=True)
    return oauth.lichess.authorize_redirect(redirect_uri)


@app.route('/authorize')
def authorize():
    token = oauth.lichess.authorize_access_token()
    bearer = token['access_token']
    headers = {'Authorization': f'Bearer {bearer}'}
    response = requests.get("https://lichess.org/api/account", headers=headers)
    return jsonify(**response.json())


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/game')
def game():
    return render_template('game.html')

@app.route('/settings')
def settings():
    return render_template('settings.html')


@socketio.on('cancelSearch', namespace='/connect')
def cancelSearch(payload):
    return game_server.cancel_search(payload)


# First connection of a player - returns the details of user as known by the server
@socketio.on('play', namespace='/connect')
def play(payload):
    response = game_server.play(payload)
    join_room(response.dst_sid)
    if "game" in response.extra_data:
        the_dict = {'color': response.src_color, 'game':response.extra_data["game"]}
        connection = "game"
        socketio.emit(connection, the_dict, namespace='/connect', room=response.dst_sid)
    return response.dst_sid


@socketio.on('heartbeat', namespace='/connect')
def heartbeat(payload):
    try:
        response = game_server.heartbeat(payload)
        #if response is None:
        #    return
        join_room(response.dst_sid)
        if not response.extra_data:
            return {}
        elif "game" not in response.extra_data:
            return response.extra_data
        connection = "game"
        socketio.emit(connection, {'color': response.src_color, 'game':response.extra_data["game"]}, namespace='/connect', room=response.dst_sid)
        return {}
    except Exception as e:
        print("Got Exception from heartbeat")
        print(e)
        return None


@socketio.on('move', namespace='/connect')
def move(payload):
    send_to, data = game_server.move(payload)
    if send_to is None:     # quitting due to game over/bad move
        return
    socketio.emit("move", data, namespace='/connect', room=send_to)
    # send back to sender in case he has more than one page open
    socketio.emit("move", data, namespace='/connect', room=payload["sid"])
    if "extra_data" in data:
        socketio.emit("game_over", data["extra_data"].to_dict(), namespace='/connect', room=send_to)
        # send back to sender to signal draw
        socketio.emit("game_over", data["extra_data"].to_dict(), namespace='/connect', room=payload["sid"])
    return data


@socketio.on('draw', namespace='/connect')
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


@socketio.on('rematch', namespace='/connect')
def rematch(payload):
    response = game_server.rematch(payload)
    if response is None:     # quitting due to game over/bad move
        return False
    else:
        socketio.emit("rematch", {"color": response.src_color, "flag": response.result.value}, namespace='/connect', room=response.dst_sid)
        # send back to sender in case he has more than one page open
        socketio.emit("rematch", {"color": response.src_color, "flag": response.result.value}, namespace='/connect', room=response.src_sid)
    return True


@socketio.on('resign', namespace='/connect')
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


@socketio.on('abort', namespace='/connect')
def abort(payload):
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
    socketio.run(app)
