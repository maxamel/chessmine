import json, time, threading, chess, uuid, requests, redis
from player import Player
from static.backend.random_matcher import RandomMatcher

current_milli_time = lambda: int(round(time.time() * 1000))


class GameServer:

    def __init__(self):
        self.clients = {}
        self.games = []
        self.mapping_rival = {}
        self.mapping_time = {}
        self.mapping_remaining = {}
        self.timer = None
        self.board = chess.Board()
        self.r = None
        self.matcher = RandomMatcher()

    def map_rivals(self, player1, player2):
        self.mapping_rival[player1] = player2
        self.mapping_rival[player2] = player1

    def get_player(self, cookie):
        if not cookie["sid"]:
            sid = uuid.uuid4().hex
        else:
            sid = cookie["sid"]
        if sid not in self.clients:
            player = Player(sid=sid)
            self.clients[sid] = player
        player = self.clients.get(sid)
        return player

    def find_match(self, player):
        return self.matcher.match(player)

    def game_over(self, winner, msg):
        if self.timer is not None:
            self.timer.cancel()
        requests.get("http://localhost:5000/match/" + winner, timeout=3)

    def move(self, payload):
        if self.timer is not None:
            self.timer.cancel()
        sid = payload["sid"]
        curr_time = current_milli_time()
        move = payload["move"]
        the_move = chess.Move.from_uci(move["from"] + move["to"])
        if not self.board.is_legal(the_move):
            print(the_move)
            raise ValueError("Illegal move captured!")
        self.board.push(the_move)
        if self.board.is_game_over():
            thread = threading.Thread(target=self.game_over, args=(self.mapping_rival[sid], "Game Over",))
            thread.start()
        rival = self.mapping_rival[sid]
        if sid in self.mapping_time:
            last_time = self.mapping_time[sid]
            elapsed = curr_time - last_time if last_time > 0 else 0
            payload["remaining"] = self.mapping_remaining[rival]
            payload["other_remaining"] = self.mapping_remaining[sid] - elapsed
            self.timer = threading.Timer(payload["remaining"] / 1000, self.game_over, [self.mapping_rival[sid], "Lost on time"])
            self.timer.start()
            self.mapping_remaining[sid] = payload["other_remaining"]
            self.mapping_time[rival] = curr_time
        else:
            self.mapping_time[sid] = 0
            self.mapping_time[rival] = 0
            self.mapping_remaining[sid] = 300000
            self.mapping_remaining[rival] = 300000
        update = json.dumps(payload)
        send_to = self.mapping_rival[sid]
        print(send_to)
        print(update)
        return send_to, update

    def get_redis(self):
        if self.r is None:
            self.r = redis.Redis(host="localhost", port=6379, db=0)
