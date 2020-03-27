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
    game = Game(game_id=game_id, position=chess.Board().fen(), white_remaining=tc,
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


@socketio.on('connection', namespace='/connect')
def connect(cookie):
    cookie = cookie["data"]
    player = game_server.get_player_from_cookie(cookie)
    mapping = game_server.get_player_mapping(player.sid)
    if mapping is not None:
        rival = game_server.get_player_session(player.sid)
        rival_mapping = game_server.get_player_mapping(rival.sid)
        fen = game_server.get_game_fen_by_player_sid(rival.sid)
        white = player
        black = rival
        white_time = mapping.time_remaining
        black_time = rival_mapping.time_remaining
        if mapping.color == BLACK:
            white, black = black, white
            white_time, black_time = black_time, white_time
        game = Game(game_id=mapping.game_id,
                    position=fen,
                    white_remaining=white_time,
                    black_remaining=black_time,
                    white=white,
                    black=black)
        socketio.emit("game", {'color': mapping.color, 'game': game.to_dict()},
                      namespace='/connect',
                      room=player.sid)
    else:
        join_room(player.sid)
        game_server.set_player_session(player=player)
        socketio.emit("connection_id", {"user": player.to_dict()}, namespace='/connect', room=player.sid)
        game_server.find_match(player=player)


@socketio.on('update', namespace='/connect')
def move(payload):
    send_to, update = game_server.move(payload)
    socketio.emit("move", update, namespace='/connect', room=send_to)
    return update


if __name__ == '__main__':
    socketio.run(app)
