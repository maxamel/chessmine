from flask import Flask
from flask_socketio import SocketIO

app = Flask(__name__, template_folder='.')
socketio = SocketIO(app, cors_allowed_origins="*", manage_session=True, async_mode='gevent')


@app.route('/hello', methods=['GET'])
def rest_hello():
    print('HTTP Hello!')
    return 'Hello'


@socketio.on('/hello', namespace='/connect')
def ws_hello(payload):
    print('Websocket Hello!')
    return 'Hello'


if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0')
