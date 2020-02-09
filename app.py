from flask import Flask, render_template, request, session
from flask_socketio import SocketIO, emit, join_room, leave_room
import uuid, json, time, datetime, threading, chess

app = Flask(__name__,template_folder='templates')
app.config['SECRET_KEY'] = 'secret!'
socketio = SocketIO(app, cors_allowed_origins="*", manage_session=True)


@app.route('/')
def index():
    return render_template('boot.html')


clients = []
games = []
mapping_rival = {}
mapping_time = {}
mapping_remaining = {}
timer = None
board = chess.Board()

current_milli_time = lambda: int(round(time.time() * 1000))


@socketio.on('connection', namespace='/connect')
def connect():
    print("Connection " + request.sid)
    sid = request.sid
    socketio.emit("connection_id", {"id": sid}, namespace='/connect')
    clients.append(sid)
    join_room(sid)
    if len(clients) == 2:
        games.append((clients[0], clients[1]))
        mapping_rival[clients[0]] = clients[1]
        mapping_rival[clients[1]] = clients[0]
        socketio.emit("game", {'color': 'black'}, namespace='/connect', room=clients[0])
        socketio.emit("game", {'color': 'white'}, namespace='/connect', room=clients[1])


def game_over(winner, msg):
    timer.cancel()
    socketio.emit("game_over", {'winner': winner, 'message': msg}, namespace='/connect', room=clients[0])
    socketio.emit("game_over", {'winner': winner, 'message': msg}, namespace='/connect', room=clients[1])


@socketio.on('update', namespace='/connect')
def move(payload):
    global timer
    if timer is not None:
        timer.cancel()
    curr_time = current_milli_time()
    print("Move " + request.sid)
    move = payload["move"]
    print(move["from"]+move["to"])
    the_move = chess.Move.from_uci(move["from"]+move["to"])
    if not board.is_legal(the_move):
        raise ValueError("Illegal move captured!")
    board.push(the_move)
    if board.is_game_over():
        game_over(mapping_rival[request.sid], "Game Over")
    rival = mapping_rival[request.sid]
    if request.sid in mapping_time:
        last_time = mapping_time[request.sid]
        elapsed = curr_time-last_time if last_time>0 else 0
        payload["remaining"] = mapping_remaining[rival]
        payload["other_remaining"] = mapping_remaining[request.sid]-elapsed
        timer = threading.Timer(payload["remaining"]/1000, game_over, [mapping_rival[request.sid], "Lost on time"])
        timer.start()
        mapping_remaining[request.sid] = payload["other_remaining"]
        mapping_time[rival] = curr_time
    else:
        mapping_time[request.sid] = 0
        mapping_time[rival] = 0
        mapping_remaining[request.sid] = 300000
        mapping_remaining[rival] = 300000
    update = json.dumps(payload)
    print(update)
    send_to = mapping_rival[request.sid]
    socketio.emit("move", update, namespace='/connect', room=send_to)
    return update


if __name__ == '__main__':
    socketio.run(app)
