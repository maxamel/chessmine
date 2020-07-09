import json
import time, requests

from threading import Thread

from static.backend.player import Player
from static.backend.matcher import Matcher
from static.backend.redis_plug import RedisPlug
from static.backend.util import get_millis_for_time_control


class RandomMatcher(Matcher):
    def __init__(self):
        self.redis_plug = RedisPlug()

    def match(self, player: Player):
        self.redis_plug.add_players_to_search_pool(player.sid)
        thread = Thread(target=self.search, args=(player.sid,))
        thread.start()

    def search(self, player_sid: str) -> str:
        while True:
            rival_sid = self.redis_plug.draw_player_from_search_pool()
            if rival_sid is None:
                print("Could not draw player out of pool")
                return None
            elif rival_sid != player_sid:
                ret = self.redis_plug.remove_players_from_search_pool(rival_sid, player_sid)
                if ret == 0:
                    if not self.redis_plug.is_player_in_search_pool(player_sid=player_sid):
                        # Someone already matched us
                        print("Someone else matched our player. We can safely abandon search")
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
            time.sleep(1)
