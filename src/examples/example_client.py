import time

import socketio


def test():
    def callback(item):
        print(f'Called back with {item}')

    with socketio.SimpleClient(logger=False, engineio_logger=False) as sio:
        sio.connect(url='http://localhost/', namespace='/connect', transports=['websocket'])
        sio.client.emit('/hello', {}, namespace='/connect', callback=callback)
        time.sleep(5)


if __name__ == '__main__':
    test()
