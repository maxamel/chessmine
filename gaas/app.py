from flask import Flask, render_template, request
from flask_socketio import SocketIO, join_room

from static.backend.game_server import GameServer


app = Flask(__name__, template_folder='.')
app.config['SECRET_KEY'] = 'secret!'
socketio = SocketIO(app, cors_allowed_origins="*", manage_session=True)
game_server = GameServer()


@app.route('/match/<player1>/<player2>')
def match(player1, player2):
    socketio.emit("game", {'color': 'black'}, namespace='/connect', room=player1)
    socketio.emit("game", {'color': 'white'}, namespace='/connect', room=player2)
    game_server.map_rivals(player1, player2)
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
    player = game_server.get_player(cookie)
    join_room(player.sid)
    socketio.emit("connection_id", {"user": player.__dict__}, namespace='/connect', room=player.sid)

    game_server.find_match(player=player)


@socketio.on('update', namespace='/connect')
def move(payload):
    send_to, update = game_server.move(payload)
    print(update)
    socketio.emit("move", update, namespace='/connect', room=send_to)
    return update


if __name__ == '__main__':
    socketio.run(app)
