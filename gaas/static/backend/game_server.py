import json, time, threading, chess, uuid, requests, logging

from static.backend.elo import EloRating
from static.backend.logger import get_logger
from static.backend.player import Player, PlayerMapping, Game, PlayerGameInfo
from static.backend.random_matcher import RandomMatcher
from static.backend.redis_plug import RedisPlug
from static.backend.consts import *
from static.backend.server_response import ServerResponse, EndGameInfo
from static.backend.util import get_turn_from_fen, GameStatus, get_opposite_color, get_millis_for_time_control, Result, \
    piece_symbol_to_obj, ConnectStatus

current_milli_time = lambda: int(round(time.time() * 1000))

lgr = get_logger()

class GameServer:

    def __init__(self):
        self.redis = RedisPlug()
        self.matcher = RandomMatcher()
        self.th = threading.Thread(target=self.work)
        self.th.start()
        lgr.info("Initialized Game Server! {}".format("Hello World"))

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
                            lgr.info("A move has been made and we weren't fast enough to complete the removal operation")
                            continue
                        lgr.info("Ending game " + game_id)
                        game = self.redis.get_game(game_id)
                        fen = game[FEN]
                        turn = get_turn_from_fen(fen)
                        winner = get_opposite_color(turn)
                        loser_info = game[turn]
                        self.redis.set_player_mapping_value(loser_info, REMAINING_TIME, 0)
                        requests.get("http://localhost:5000/game_over/" + winner)
                        self.set_game_status(game_id, GameStatus.ENDED)
                        #self.cleanup(game_id=game_id)
        except Exception as e:
            lgr.error("Error in worker {}".format(e))

    def cleanup(self, game_id: str):
        game = self.redis.get_game(game_id=game_id)
        white = game[WHITE]
        black = game[BLACK]
        self.redis.remove_game_info(game_id)
        self.redis.remove_player_mapping(white)
        self.redis.remove_player_mapping(black)
        self.redis.remove_player_mapping()
        lgr.info("Removed info of game with id {}".format(game_id))

    def map_rivals(self, player1, player2, time_control):
        game_id = uuid.uuid4().hex
        lgr.info("Mapping rivals with args: {}, {}, {}, {}".format(player1, player2, game_id, time_control))
        self.redis.map_player(player=player1, opponent=player2, game_id=game_id, color=WHITE, time_control=time_control)
        self.redis.map_player(player=player2, opponent=player1, game_id=game_id, color=BLACK, time_control=time_control)
        self.redis.map_game(game_id=game_id, white_sid=player1, black_sid=player2)
        return game_id

    def get_game_fen(self, game_id):
        return self.redis.get_game_fen(game_id=game_id)

    def get_game_moves(self, game_id):
        return self.redis.get_game_moves(game_id=game_id)

    def get_game_fens(self, game_id):
        return self.redis.get_game_fens(game_id=game_id)

    def get_game_status(self, game_id):
        return self.redis.get_game_status(game_id=game_id)

    def set_game_status(self, game_id, status):
        self.redis.set_game_status(game_id=game_id, status=status)

    def set_game_endgame(self, game_id, end_game_info: EndGameInfo):
        self.redis.set_game_endgame(game_id=game_id, end_game=end_game_info)

    def get_game_endgame(self, game_id):
        return self.redis.get_game_endgame(game_id=game_id)

    def get_player_mapping(self, sid) -> PlayerMapping:
        return self.redis.get_player_mapping(sid)

    def set_player_session(self, player: Player) -> Player:
        self.redis.set_player_session(player=player)

    def set_player_session(self, player: Player) -> Player:
        self.redis.set_player_session(player=player)

    def get_player_session(self, sid) -> Player:
        return self.redis.get_player_session(sid)

    def get_player_from_cookie(self, cookie):
        #cookie = json.loads(cookie)
        if "sid" not in cookie:
            player = Player(preferences=cookie["preferences"])
        else:
            sid = cookie["sid"]
            preferences = cookie["preferences"]
            player = self.get_player_session(sid=sid)
            if player is None:       # First time we see this player
                player = Player(preferences=preferences)
            else:
                player = Player(sid=sid, name=player.name, rating=player.rating, preferences=preferences)
        self.set_player_session(player=player)
        lgr.debug("Set player session: {}".format(player.to_dict()))
        return player

    def find_match(self, player):
        return self.matcher.match(player)

    def cancel_search(self, payload):
        data = payload["data"]
        sid = data["sid"]
        return self.redis.remove_players_from_search_pool(sid)

    def func(self, sid1, sid2, time_control):
        requests.get(url="http://localhost:5000/match/" + sid1 + "/" + sid2, json={'time_control': time_control})

    def rematch(self, payload):
        # Rematch request
        # Return the offeree, offeror color
        data = payload["data"]
        sid = data["sid"]
        flag = data["flag"]
        player_info = self.redis.get_player_mapping(sid)
        if self.get_game_status(player_info.game_id) != GameStatus.ENDED.value:
            lgr.error("Got rematch command for a game in progress. Game id: {}. Player: {}".format(player_info.game_id, player_info.sid))
            return None
        game_id = player_info.game_id
        rival_info = self.redis.get_player_mapping(player_info.opponent)
        if rival_info.rematch_offer == 1:
            if flag:    # rematch agreed
                self.redis.cancel_game_timeout(game_id=game_id)
                self.redis.set_player_mapping_value(player=sid, key=REMATCH_OFFER, val=1)
                self.redis.remove_game_info(game_id)
                #self.cleanup(game_id=game_id)
                session = self.redis.get_player_session(player_info.sid)
                sid1 = player_info.sid
                sid2 = rival_info.sid
                if player_info.color == WHITE:
                    sid1 = rival_info.sid
                    sid2 = sid
                my_thread = threading.Thread(target=self.func, args=(sid1, sid2,
                                             get_millis_for_time_control(session.preferences['time_control'])))
                my_thread.start()
                res = ServerResponse(dst_sid=rival_info.sid, src_sid=sid, src_color=player_info.color, dst_color=rival_info.color,
                                     result=Result.REMATCH_AGREED)
                lgr.info("Rematch agreed between players {},{}".format(sid1, sid2))
                return res
            else:       # decline
                self.redis.set_player_mapping_value(player=rival_info.sid, key=REMATCH_OFFER, val=0)
                res = ServerResponse(dst_sid=rival_info.sid, src_sid=sid, src_color=player_info.color,
                                     dst_color=rival_info.color, result=Result.REMATCH_DECLINED)
                lgr.info("Rematch offer declined by {}".format(player_info.sid))
                return res
        else:
            val = 0
            result = Result.REMATCH_DECLINED
            if flag:
                val = 1
                result =Result.REMATCH_OFFERED
                lgr.info("Rematch offered by {}".format(player_info.sid))
            self.redis.set_player_mapping_value(player=sid, key=REMATCH_OFFER, val=val)
            res = ServerResponse(dst_sid=rival_info.sid, src_sid=sid, src_color=player_info.color,
                                 dst_color=rival_info.color, result=result)
            return res

    def draw(self, payload):
        # Draw offer or Draw response
        # Return the Response object
        data = payload["data"]
        sid = data["sid"]
        flag = data["flag"]
        player_info = self.redis.get_player_mapping(sid)
        if player_info is None or self.get_game_status(player_info.game_id) == GameStatus.ENDED.value:
            if player_info is not None:
                lgr.error("Got draw command for an ended or non-existent game. Player: {}".format(sid))
            return None
        curr_time = current_milli_time()
        # Update player last seen
        self.redis.set_player_mapping_value(player_info.sid, LAST_SEEN, curr_time)
        game_id = player_info.game_id
        rival_info = self.redis.get_player_mapping(player_info.opponent)
        if rival_info.draw_offer == 1:
            if flag:    # draw by agreement
                self.redis.cancel_game_timeout(game_id=game_id)
                self.set_game_status(player_info.game_id, GameStatus.ENDED)
                rating_dict = self._update_ratings(sid, rival_info.sid, player_info.color, outcome=0)
                egi = EndGameInfo(message="Draw By Agreement", white_rating=rating_dict[WHITE].get(RATING),
                                  black_rating=rating_dict[BLACK].get(RATING), white_rating_delta=rating_dict[WHITE].get(RATING_DELTA),
                                  black_rating_delta=rating_dict[BLACK].get(RATING_DELTA), winner="Draw")
                self.set_game_endgame(game_id=game_id, end_game_info=egi)
                res = ServerResponse(dst_sid=rival_info.sid, src_sid=sid, src_color=player_info.color,
                                     dst_color=rival_info.color, end_game_info=egi, result=Result.DRAW_AGREED)
                lgr.info("Draw agreed between players {},{} for game {}".format(player_info.sid, rival_info.sid, player_info.game_id))
                return res
            else:       # decline
                self.redis.set_player_mapping_value(player=rival_info.sid, key=DRAW_OFFER, val=0)
                res = ServerResponse(dst_sid=rival_info.sid, src_sid=sid, result=Result.DRAW_DECLINED,
                                     src_color=player_info.color, dst_color=rival_info.color)
                lgr.debug("Draw declined by player {} for game {}".format(player_info.sid, player_info.game_id))
                return res
        else:
            val = 0
            result = Result.DRAW_DECLINED
            if flag:
                val = 1
                result = Result.DRAW_OFFERED
                lgr.info("Draw offered by {} for game {}".format(player_info.sid, player_info.game_id))
            self.redis.set_player_mapping_value(player=sid, key=DRAW_OFFER, val=val)
            res = ServerResponse(dst_sid=rival_info.sid, src_sid=sid, result=result,
                                 src_color=player_info.color, dst_color=rival_info.color)
            return res

    def resign(self, payload):
        data = payload["data"]
        sid = data["sid"]
        player_info = self.redis.get_player_mapping(sid)
        if self.get_game_status(player_info.game_id) == GameStatus.ENDED.value:
            return
        rival_info = self.redis.get_player_mapping(player_info.opponent)
        rating_dict = self._update_ratings(sid, rival_info.sid, player_info.color, outcome=2)
        self.set_game_status(player_info.game_id, GameStatus.ENDED)
        egi = EndGameInfo(winner=rival_info.color, message=f"{player_info.color} resigned",
                          white_rating=rating_dict[WHITE].get(RATING), black_rating=rating_dict[BLACK].get(RATING),
                          white_rating_delta=rating_dict[WHITE].get(RATING_DELTA), black_rating_delta=rating_dict[BLACK].get(RATING_DELTA))
        self.set_game_endgame(game_id=player_info.game_id, end_game_info=egi)
        res = ServerResponse(dst_sid=rival_info.sid, src_sid=sid, src_color=player_info.color,
                             dst_color=rival_info.color, end_game_info=egi, result=Result.RESIGN)
        self.redis.cancel_game_timeout(game_id=player_info.game_id)
        lgr.info("Player {} resigned game {}".format(player_info.sid, player_info.game_id))
        return res

    def abort(self, payload):
        data = payload["data"]
        sid = data["sid"]
        player_info = self.redis.get_player_mapping(sid)
        if (self.get_game_status(player_info.game_id) == GameStatus.ENDED.value):
            lgr.info("Illegal attempt by player {} to abort game {} which is already ended".format(player_info.sid, player_info.game_id))
            return
        rival_info = self.redis.get_player_mapping(player_info.opponent)
        if player_info.turn_start_time != 'None' and rival_info.turn_start_time != 'None':
            lgr.info("Illegal attempt by player {} to abort game {} which is already in progress".format(player_info.sid, player_info.game_id))
            return None
        rating_dict = self._update_ratings(sid, rival_info.sid, player_info.color, outcome=3)
        self.set_game_status(player_info.game_id, GameStatus.ENDED)
        egi = EndGameInfo(winner="Abort", message=f"{player_info.color} aborted",
                          white_rating=rating_dict[WHITE].get(RATING), black_rating=rating_dict[BLACK].get(RATING),
                          white_rating_delta=rating_dict[WHITE].get(RATING_DELTA), black_rating_delta=rating_dict[BLACK].get(RATING_DELTA))
        self.set_game_endgame(game_id=player_info.game_id, end_game_info=egi)
        res = ServerResponse(dst_sid=rival_info.sid, src_sid=sid, src_color=player_info.color,
                             dst_color=rival_info.color, end_game_info=egi, result=Result.ABORT)
        self.redis.cancel_game_timeout(game_id=player_info.game_id)
        lgr.info("Player {} aborted game {}".format(player_info.sid, player_info.game_id))
        return res

    def move(self, payload):
        '''
        :param payload: the move as recorded by user
        :return: sid of the player to send this move to and the move data slightly changed
        '''
        #print(payload)
        sid = payload["sid"]
        player_info = self.redis.get_player_mapping(sid)
        if (self.get_game_status(player_info.game_id) == GameStatus.ENDED.value):
            return
        game_id = player_info.game_id

        move = payload["move"]
        the_move = chess.Move.from_uci(move["from"] + move["to"])
        if "promotion" in move:
            piece = piece_symbol_to_obj(move["promotion"])
            the_move.promotion = piece

        game_fen = self.redis.get_game_fen(player_info.game_id)
        if game_fen is None:
            board = chess.Board()
        else:
            board = chess.Board(game_fen)
        if not board.is_legal(the_move):
            lgr.error("Illegal move {} by player {} in game {}".format(move["san"], player_info.sid, player_info.game_id))
            return None, None
        board.push(the_move)

        canceled = self.redis.cancel_game_timeout(game_id=game_id)
        lgr.debug("Move {} played by player {} in game {}".format(move["san"], player_info.sid, player_info.game_id))
        if player_info.ttl_start_time != 'None':
            self.redis.set_player_mapping_value(player_info.sid, TTL_START_TIME, 'None')
        if canceled != 1 and player_info.turn_start_time != 0 and player_info.turn_start_time != 'None':
            # we're in the process of timeouting the game. Just quit now and let it timeout gracefully
            lgr.error("Move {} by player {} is not counted due to game {} termination".format(move["san"], player_info.sid, player_info.game_id))
            return None, None
        rival = player_info.opponent
        rival_info = self.redis.get_player_mapping(rival)
        if rival_info.draw_offer == 1:
            # if rival proposed draw it means it's been declined
            self.redis.set_player_mapping_value(rival_info.sid, DRAW_OFFER, 0)
        # Handle timing updates
        curr_time = current_milli_time()
        # Update player last seen
        self.redis.set_player_mapping_value(sid, LAST_SEEN, curr_time)
        if player_info.turn_start_time != 'None':
            last_time = int(player_info.turn_start_time)
            elapsed = curr_time - last_time if last_time > 0 else 0
            payload["remaining"] = int(rival_info.time_remaining)
            payload["other_remaining"] = int(player_info.time_remaining) - elapsed
            if payload["other_remaining"] <= 0:
                # This move was too late. Timeout function was late in picking it up.
                # But this move is illegal and we're stopping this game right now!
                self.redis.set_game_timeout(game_id=game_id, timeout=curr_time)
                lgr.error("Move {} by player {} in game {} recorded too late. Terminating game now.".format(move["san"], player_info.sid, player_info.game_id))
                return None, None
            expire_in_future = curr_time + payload["remaining"]
            self.redis.set_game_timeout(game_id=game_id, timeout=expire_in_future)
            self.redis.set_player_mapping_value(sid, REMAINING_TIME, payload["other_remaining"])
            self.redis.set_player_mapping_value(rival, TURN_START_TIME, curr_time)
        else:
            self.redis.set_player_mapping_value(sid, TURN_START_TIME, 0)
            self.redis.set_player_mapping_value(rival, TURN_START_TIME, 0)

        # Handle the move itself, board update, etc.
        moves = self.redis.get_game_moves(game_id)
        if len(moves) == 0:       # first move
            self.redis.set_player_mapping_value(rival_info.sid, TTL_START_TIME, curr_time)
            expire_in_future = curr_time + 30000        # 30 seconds from now
            print("Setting expiration time {}".format(expire_in_future))
            self.redis.set_game_timeout(game_id=game_id, timeout=expire_in_future)
        self.redis.set_game_fen(game_id, board.fen())
        self.redis.add_fen_to_game(game_id, board.fen())
        self.redis.add_move_to_game(game_id, move["san"])

        if len(moves) > 1:
            self.redis.set_game_status(game_id, GameStatus.PLAYING)
        if board.is_fivefold_repetition():
            # Draw by fivefold repetition
            self.redis.cancel_game_timeout(game_id=game_id)
            self.set_game_status(player_info.game_id, GameStatus.ENDED)
            rating_dict = self._update_ratings(sid, rival_info.sid, outcome=0)
            egi = EndGameInfo(winner="Draw", message=f"Draw By Five-Fold Repetition",
                              white_rating=rating_dict[WHITE].get(RATING), black_rating=rating_dict[BLACK].get(RATING),
                              white_rating_delta=rating_dict[WHITE].get(RATING_DELTA),
                              black_rating_delta=rating_dict[BLACK].get(RATING_DELTA))
            self.set_game_endgame(game_id=player_info.game_id, end_game_info=egi)
            payload["extra_data"] = egi
            lgr.info("Game Over. Five-Fold Repetition", get_turn_from_fen(board.fen()))
        elif board.is_game_over():
            # reset previous timeout settings due to turn switching
            self.redis.cancel_game_timeout(game_id=game_id)
            self.set_game_status(player_info.game_id, GameStatus.ENDED)
            rating_dict = self._update_ratings(sid, rival_info.sid, outcome=1)
            egi = EndGameInfo(winner=player_info.color, message=f"{rival_info.color} checkmated",
                              white_rating=rating_dict[WHITE].get(RATING), black_rating=rating_dict[BLACK].get(RATING),
                              white_rating_delta=rating_dict[WHITE].get(RATING_DELTA),
                              black_rating_delta=rating_dict[BLACK].get(RATING_DELTA))
            self.set_game_endgame(game_id=player_info.game_id, end_game_info=egi)
            payload["extra_data"] = egi
            lgr.info("Game Over. {} checkmated", rival_info.color)
        update = json.dumps(payload)
        #print(update)
        return rival, update

    def play(self, payload):
        '''
        :param payload: the cookie as sent by player
        :return: sid of recepient player and the data to send
        '''
        cookie = payload["data"]
        player = self.get_player_from_cookie(cookie)
        mapping = self.get_player_mapping(player.sid)
        if mapping is not None:
            self.set_player_session(player=player)
            if self.redis.is_game_mapping_exists(mapping.game_id):
                game = self.redis.get_game(mapping.game_id)
                if int(game[STATUS]) != GameStatus.ENDED.value:   # if game in progress return to game
                    return self._get_player_game(player)
                else:
                    self.redis.remove_player_mapping(player.sid)

        if not self.get_player_session(sid=player.sid):
            # We don't recognize this user. Regenerate sid
            player = Player(preferences=player.preferences)
            self.set_player_session(player=player)
        lgr.info("Player {} connecting to play. Initiating match search".format(player.sid))
        self.find_match(player=player)
        ser_res = ServerResponse(dst_sid=player.sid, extra_data={'user': player.to_dict()})
        return ser_res

    def heartbeat(self, payload) -> ServerResponse:
        '''
        This method is called by client in two cases:
        1) A periodic keepalive ("checkin")
        2) A request to pull entire game data
        If player's sid is unknown
        :param payload: the cookie as sent by player
        :return: ServerResponse with sid of recepient player in case of periodic call and full game data in case of full heartbeat request
        :raises: ValueError if player's sid is unknown
        '''
        cookie = payload["data"]
        if not cookie or cookie == 'null' or not self.redis.is_player_session_exists(cookie["sid"]):
            lgr.error("Unrecognized heartbeat payload: {}".format(cookie))
            raise ValueError("Unrecognized entity hearbeated us")
        curr_time = current_milli_time()
        if "checkin" in cookie:
            sid = cookie["sid"]
            rival_connect_status = None
            if self.redis.is_player_mapping_exists(sid):    # There is a game in progress
                self.redis.set_player_mapping_value(sid, LAST_SEEN, curr_time)
                rival_sid = self.redis.get_player_mapping_value(sid, OPPONENT)
                rival_last_seen = int(self.redis.get_player_mapping_value(rival_sid, LAST_SEEN))
                rival_connect_status = ConnectStatus.CONNECTED.value if curr_time-rival_last_seen < 10000 else ConnectStatus.DISCONNECTED.value
            return ServerResponse(dst_sid=sid, extra_data={"rival_connect_status": rival_connect_status})

        player = self.get_player_from_cookie(cookie)
        lgr.debug("Player {} requested full heartbeat".format(player.sid))
        if self.redis.is_player_mapping_exists(player.sid):
            self.redis.set_player_mapping_value(player.sid, LAST_SEEN, curr_time)
            return self._get_player_game(player)
        else:       # We don't have a mapping yet. Probably waiting for match
            return ServerResponse(dst_sid=player.sid)

    def _get_player_game(self, player: Player):
        mapping = self.get_player_mapping(player.sid)
        if not self.redis.is_game_mapping_exists(mapping.game_id):      # Rematch scheduled - game hasn't been started yet but previous one is deleted
            return ServerResponse(dst_sid=player.sid)
        curr_time = current_milli_time()
        rival = self.get_player_session(mapping.opponent)
        rival_mapping = self.get_player_mapping(rival.sid)
        status = self.get_game_status(mapping.game_id)
        fen = self.get_game_fen(mapping.game_id)
        moves = self.get_game_moves(mapping.game_id)
        fens = self.get_game_fens(mapping.game_id)
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
        draw_offer = None
        if mapping.draw_offer != 'None':
            if mapping.draw_offer == 1:
                draw_offer = mapping.color
        if rival_mapping.draw_offer != 'None':
            if rival_mapping.draw_offer == 1:
                draw_offer = rival_mapping.color
        egi = None      # end game is None until game is over
        # player connecting in middle of turn. Adjust his remaining time to reflect how much time he's got
        # left starting now (check we're in middle of turn)
        if status == GameStatus.PLAYING.value:
            if turn == BLACK and black_turn_start_time != 'None' and black_turn_start_time > 0:
                elapsed = curr_time - black_turn_start_time
                black_time -= elapsed
            elif white_turn_start_time != 'None' and white_turn_start_time > 0:
                elapsed = curr_time - white_turn_start_time
                white_time -= elapsed
            result = Result.GAME_IN_PROGRESS
        elif status == GameStatus.STARTED.value:
            result = Result.GAME_STARTED
        elif status == GameStatus.ENDED.value:
            result = Result.GAME_ENDED
            egi = self.get_game_endgame(game_id=mapping.game_id)
        else:
            raise ValueError("Unknown game status %s", status)

        white_info = PlayerGameInfo(name=white.name, rating=white.rating, time_remaining=white_time)
        black_info = PlayerGameInfo(name=black.name, rating=black.rating, time_remaining=black_time)
        game = Game(game_id=mapping.game_id,
                    position=fen,
                    moves=moves,
                    fens=fens,
                    white=white_info,
                    black=black_info,
                    move_ttl=move_ttl,
                    draw_offer=draw_offer,
                    status=status,
                    end_game_info=egi
                    )
        ser_res = ServerResponse(dst_sid=player.sid, src_color=mapping.color, result=result, extra_data={'game': game.to_dict()})
        return ser_res

    def _update_ratings(self, sid1, sid2, color, outcome):
        # returns rating, delta for sid1 and rating, delta for sid2
        player_session = self.get_player_session(sid1)
        rival_session = self.get_player_session(sid2)
        ratingA, ratingB = EloRating(player_session.rating, rival_session.rating, d=outcome)

        lgr.info("Rating calculation: Player {} - New Rating: {}({}), Old Rating: {}".format(sid1, ratingA, ratingA - player_session.rating, player_session.rating))
        lgr.info("Rating calculation: Player {} - New Rating: {}({}), Old Rating: {}".format(sid2, ratingB, ratingB - rival_session.rating, rival_session.rating))
        self.redis.set_player_session_value(player_session.sid, RATING, ratingA)
        self.redis.set_player_session_value(rival_session.sid, RATING, ratingB)
        self.redis.set_player_mapping_value(player_session.sid, RATING_DELTA, ratingA - player_session.rating)
        self.redis.set_player_mapping_value(rival_session.sid, RATING_DELTA, ratingB - rival_session.rating)
        return {color: {RATING: ratingA, RATING_DELTA: ratingA - player_session.rating}, get_opposite_color(color): {RATING: ratingB, RATING_DELTA: ratingB - rival_session.rating}}
        #return ratingA, ratingB
