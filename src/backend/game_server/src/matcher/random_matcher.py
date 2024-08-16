import logging
import time
import requests

from threading import Thread

from matcher.matcher import Matcher
from player import Player
from redis_plug import RedisPlug
from util import get_millis_for_time_control


class RandomMatcher(Matcher):
    def __init__(self):
        self.redis_plug = RedisPlug()

    def match(self, player: Player):
        self.redis_plug.add_players_to_search_pool(player.sid)
        thread = Thread(target=self.search, args=(player.sid,))
        thread.start()
        thread.join()

    def search(self, player_sid: str) -> str:
        loop_round = 0
        while loop_round < 6:    # up to six rounds
            rival_sid = self.redis_plug.draw_player_from_search_pool()
            if rival_sid is None:
                logging.info("Could not draw player out of pool")
                return None
            elif rival_sid != player_sid:
                ret = self.redis_plug.remove_players_from_search_pool(rival_sid, player_sid)
                if ret == 0:
                    if not self.redis_plug.is_player_in_search_pool(player_sid=player_sid):
                        # Someone already matched us
                        logging.info("Someone else matched our player. We can safely abandon search")
                        return None
                    else:
                        # Someone beat us to the rival
                        time.sleep(1)
                        continue
                player = self.redis_plug.get_player_session(player_sid)
                rival = self.redis_plug.get_player_session(rival_sid)
                if player.preferences["time_control"] != rival.preferences["time_control"]:
                    # This match isn't valid - keep searching
                    self.redis_plug.add_players_to_search_pool(player_sid, rival_sid)
                    print("Got invalid match by time control")
                # transmit this match
                else:
                    requests.get(url="http://localhost:5000/match/"+player_sid+"/"+rival_sid,
                             json={'time_control': get_millis_for_time_control(player.preferences['time_control'])})
            loop_round += 1
            time.sleep(1)
        ret = self.redis_plug.remove_players_from_search_pool(player_sid)
        logging.info(f"Search yielded no results so matching with engine. Removed player from search pool: {ret == 1}")
        requests.get(url="http://localhost:5000/match/" + player_sid + "/@",
                     json={'time_control': get_millis_for_time_control('30+0')})
