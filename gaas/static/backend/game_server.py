import json, time, threading, chess, uuid, requests
from static.backend.player import Player, PlayerMapping, Game
from static.backend.random_matcher import RandomMatcher
from static.backend.redis_plug import RedisPlug
from static.backend.consts import *
from static.backend.util import get_turn_from_fen

current_milli_time = lambda: int(round(time.time() * 1000))


class GameServer:

    def __init__(self):
        self.redis = RedisPlug()
        self.matcher = RandomMatcher()
        self.th = threading.Thread(target=self.work)
        self.th.start()

    def work(self):
        try:
            while True:
                time.sleep(1)
                res = self.redis.peek_game_timeout()
                if not res:
                    pass
                else:
                    game_id = res[0][0]
                    end_time = res[0][1]
                    if current_milli_time() >= int(end_time):
                        # game over
                        canceled = self.redis.cancel_game_timeout(game_id)
                        if canceled != 1:
                            # A move has been made just in time and we weren't fast enough to handle this timeout.
                            # The move function should check that it's been made past the time and quit the game
                            print("A move has been made and we weren't fast enough to complete the removal operation.")
                            continue
                        print("Ending game " + game_id)
                        game = self.redis.get_game(game_id)
                        print(game)
                        fen = game[FEN]
                        turn = get_turn_from_fen(fen)
                        winner = BLACK
                        if turn == BLACK:
                            winner = WHITE
                        requests.get("http://localhost:5000/game_over/" + winner)
                        self.cleanup(game_id=game_id)
        except Exception as e:
            print(e)

    def cleanup(self, game_id: str):
        game = self.redis.get_game(game_id=game_id)
        white = game[WHITE]
        black = game[BLACK]
        self.redis.remove_game_info(game_id)
        self.redis.remove_player_mapping(white)
        self.redis.remove_player_mapping(black)

    def map_rivals(self, player1, player2, time_control):
        game_id = uuid.uuid4().hex
        self.redis.map_player(player=player1, opponent=player2, game_id=game_id, color=WHITE, time_control=time_control)
        self.redis.map_player(player=player2, opponent=player1, game_id=game_id, color=BLACK, time_control=time_control)
        self.redis.map_game(game_id=game_id, white_sid=player1, black_sid=player2)
        return game_id

    def get_game_fen(self, game_id):
        return self.redis.get_game_fen(game_id=game_id)

    def get_game_moves(self, game_id):
        return self.redis.get_game_moves(game_id=game_id)

    def get_player_mapping(self, sid) -> PlayerMapping:
        return self.redis.get_player_mapping(sid)

    def set_player_session(self, player: Player) -> Player:
        self.redis.set_player_session(player=player)

    def get_player_session(self, sid) -> Player:
        return self.redis.get_player_session(sid)

    def get_player_from_cookie(self, cookie):
        if not cookie:
            sid = uuid.uuid4().hex
            player = Player(sid=sid)
        else:
            cookie = json.loads(cookie)
            sid = cookie["sid"]
            name = cookie["name"]
            rating = cookie["rating"]
            player = Player(sid=sid, name=name, rating=rating)

        return player

    def find_match(self, player):
        return self.matcher.match(player)

    def connect(self, payload):
        '''
        :param payload: the cookie as sent by player
        :return: sid of recepient player and the data to send
        '''
        cookie = payload["data"]
        player = self.get_player_from_cookie(cookie)
        mapping = self.get_player_mapping(player.sid)
        if mapping is not None:
            curr_time = current_milli_time()
            rival = self.get_player_session(mapping.opponent)
            rival_mapping = self.get_player_mapping(rival.sid)
            fen = self.get_game_fen(mapping.game_id)
            moves = self.get_game_moves(mapping.game_id)
            white = player
            black = rival
            move_ttl = mapping.ttl_start_time if mapping.ttl_start_time != 'None' else rival_mapping.ttl_start_time
            white_time = mapping.time_remaining
            white_turn_start_time = mapping.turn_start_time
            black_time = rival_mapping.time_remaining
            black_turn_start_time = rival_mapping.turn_start_time
            turn = mapping.color
            # who's turn is it? Based on who's got the lower turn start time
            if mapping.turn_start_time < rival_mapping.turn_start_time:
                turn = rival_mapping.color
            if move_ttl != 'None':
                move_ttl = 30000 - (curr_time - move_ttl)
            else:
                move_ttl = None
            if mapping.color == BLACK:
                white, black = black, white
                white_time, black_time = black_time, white_time
                white_turn_start_time, black_turn_start_time = black_turn_start_time, white_turn_start_time
            # player connecting in middle of turn. Adjust his remaining time to reflect how much time he's got
            # left starting now (check we're in middle of turn)
            if turn == BLACK and black_turn_start_time != 'None' and black_turn_start_time > 0:
                elapsed = curr_time - black_turn_start_time
                black_time -= elapsed
            elif white_turn_start_time != 'None' and white_turn_start_time > 0:
                elapsed = curr_time - white_turn_start_time
                white_time -= elapsed
            game = Game(game_id=mapping.game_id,
                        position=fen,
                        moves=moves,
                        white_remaining=white_time,
                        black_remaining=black_time,
                        white=white,
                        black=black,
                        move_ttl=move_ttl)
            return player.sid, {'color': mapping.color, 'game': game.to_dict()}
        else:
            self.set_player_session(player=player)
            self.find_match(player=player)
            return player.sid, {'user': player.to_dict()}

    def move(self, payload):
        '''
        :param payload: the move as recorded by user
        :return: sid of the player to send this move to and the move data slightly changed
        '''
        print(payload)
        sid = payload["sid"]
        player_info = self.redis.get_player_mapping(sid)
        game_id = player_info.game_id
        canceled = self.redis.cancel_game_timeout(game_id=game_id)
        if player_info.ttl_start_time != 'None':
            self.redis.set_player_value(player_info.sid, TTL_START_TIME, None)
        if canceled != 1 and player_info.turn_start_time != 0 and player_info.turn_start_time != 'None':
            # we're in the process of timeouting the game. Just quit now and let it timeout gracefully
            print("We're in the process of terminating game. No move recorded. Quitting.")
            return None, None
        rival = player_info.opponent
        rival_info = self.redis.get_player_mapping(rival)
        # Handle timing updates
        curr_time = current_milli_time()
        if player_info.turn_start_time != 'None':
            last_time = int(player_info.turn_start_time)
            elapsed = curr_time - last_time if last_time > 0 else 0
            payload["remaining"] = int(rival_info.time_remaining)
            payload["other_remaining"] = int(player_info.time_remaining) - elapsed
            if payload["other_remaining"] <= 0:
                # This move was too late. Timeout function was late in picking it up.
                # But this move is illegal and we're stopping this game right now!
                self.redis.set_game_timeout(game_id=game_id, timeout=curr_time)
                print("Move recorded too late. Ordering game termination. Quitting.")
                return None, None
            expire_in_future = curr_time + payload["remaining"]
            self.redis.set_game_timeout(game_id=game_id, timeout=expire_in_future)
            self.redis.set_player_value(sid, REMAINING_TIME, payload["other_remaining"])
            self.redis.set_player_value(rival, TURN_START_TIME, curr_time)
        else:
            self.redis.set_player_value(sid, TURN_START_TIME, 0)
            self.redis.set_player_value(rival, TURN_START_TIME, 0)
        # Handle the move itself, board update, etc.
        move = payload["move"]
        the_move = chess.Move.from_uci(move["from"] + move["to"])
        game_fen = self.redis.get_game_fen(player_info.game_id)
        game_pgn = self.redis.get_game_pgn(player_info.game_id)
        if game_fen is None:
            board = chess.Board()
        else:
            board = chess.Board(game_fen)
        if board.starting_fen == board.fen():       # first move
            self.redis.set_player_value(rival_info.sid, TTL_START_TIME, curr_time)
            expire_in_future = curr_time + 30000        # 30 seconds from now
            self.redis.set_game_timeout(game_id=game_id, timeout=expire_in_future)
        if not board.is_legal(the_move):
            print("ILLEGAL MOVE DETECTED: " + the_move)
            #raise ValueError("Illegal move captured!")
        board.push(the_move)
        print(board)
        self.redis.set_game_fen(game_id, board.fen())
        self.redis.set_game_pgn(game_id, board.pg)
        self.redis.add_move_to_game(player_info.game_id, move["san"])
        if board.is_game_over():
            # reset previous timeout settings due to turn switching
            self.redis.cancel_game_timeout(game_id=game_id)
            self.redis.set_game_timeout(game_id=game_id, timeout=curr_time)
            print(f"Game over. {get_turn_from_fen(board.fen())} checkmated.")
            #return None, None
        update = json.dumps(payload)
        print(update)
        return rival, update
