import chess
import requests
from flask import Flask, render_template, request, jsonify, url_for
from flask_socketio import SocketIO, join_room

from static.backend.consts import WHITE, BLACK
from static.backend.game_server import GameServer

from static.backend.player import Game
from authlib.integrations.flask_client import OAuth


app = Flask(__name__, template_folder='.')
app.config['SECRET_KEY'] = 'secret!'
socketio = SocketIO(app, cors_allowed_origins="*", manage_session=True)
oauth = OAuth(app)
oauth.register('lichess')
game_server = GameServer()


@app.route('/match/<sid1>/<sid2>')
def match(sid1, sid2):
    tc = request.json['time_control']
    p1 = game_server.get_player_session(sid1)
    p2 = game_server.get_player_session(sid2)
    game_id = game_server.map_rivals(sid1, sid2, time_control=tc)
    game = Game(game_id=game_id, position=chess.Board().fen(), fens=[], moves=[], white_remaining=tc,
                black_remaining=tc, white=p1, black=p2)
    print(tc)
    socketio.emit("game", {'color': WHITE, 'game': game.to_dict()},
                  namespace='/connect',
                  room=sid1)
    socketio.emit("game", {'color': BLACK, 'game': game.to_dict()},
                  namespace='/connect',
                  room=sid2)
    return 'OK'


@app.route('/game_over/<winner>')
def game_over(winner):
    socketio.emit("game_over", {'winner': winner, 'message': "HELLO"}, namespace='/connect')
    socketio.emit("game_over", {'winner': winner, 'message': "HELLO"}, namespace='/connect')
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


@app.route('/play')
def play():
    return render_template('play.html')


@socketio.on('play', namespace='/connect')
def play(cookie):
    send_to, data = game_server.play(cookie)
    join_room(send_to)
    connection = "game"
    if 'user' in data:
        connection = "connection_id"
    socketio.emit(connection, data, namespace='/connect', room=send_to)


@socketio.on('heartbeat', namespace='/connect')
def heartbeat(cookie):
    send_to, data = game_server.heartbeat(cookie)
    if send_to is None:
        return False         # ack heartbeat
    join_room(send_to)
    connection = "game"
    socketio.emit(connection, data, namespace='/connect', room=send_to)
    return True


@socketio.on('update', namespace='/connect')
def move(payload):
    send_to, data = game_server.move(payload)
    if send_to is None:     # quitting due to game over/bad move
        return
    socketio.emit("move", data, namespace='/connect', room=send_to)
    # send back to sender in case he has more than one page open
    socketio.emit("move", data, namespace='/connect', room=payload["sid"])
    return data


if __name__ == '__main__':

    socketio.run(app)
