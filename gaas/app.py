import chess
from flask import Flask, render_template, request
from flask_socketio import SocketIO, join_room

from static.backend.consts import WHITE, BLACK
from static.backend.game_server import GameServer

from static.backend.player import Game

app = Flask(__name__, template_folder='.')
app.config['SECRET_KEY'] = 'secret!'
socketio = SocketIO(app, cors_allowed_origins="*", manage_session=True)
game_server = GameServer()


@app.route('/match/<sid1>/<sid2>')
def match(sid1, sid2):
    tc = request.json['time_control']
    p1 = game_server.get_player_session(sid1)
    p2 = game_server.get_player_session(sid2)
    game_id = game_server.map_rivals(sid1, sid2, time_control=tc)
    game = Game(game_id=game_id, position=chess.Board().fen(), moves=[], white_remaining=tc,
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
    if send_to is None:     # quitting due to game over
        return
    socketio.emit("move", data, namespace='/connect', room=send_to)
    # send back to sender in case he has more than one page open
    socketio.emit("move", data, namespace='/connect', room=payload["sid"])
    return data


if __name__ == '__main__':
    socketio.run(app)
