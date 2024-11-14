import time
import requests
from threading import Thread

from logger import get_logger
from matcher.matcher import Matcher
from player import Player
from redis_plug import RedisPlug
from util import get_millis_for_time_control

lgr = get_logger(prefix="RedisSmartMatcher", path="/var/log/server.log")


class RedisSmartMatcher(Matcher):
    def __init__(self):
        self.redis_plug = RedisPlug()
        with open('src/lua/match.lua', 'r') as file:
            data = file.read()
            self.script = self.redis_plug.register_script(data)

    def match(self, player: Player):
        search_pool_name = f"search_pool_{player.preferences['time_control'].split('+')[0]}"
        ret = self.redis_plug.add_players_to_search_pool(search_pool_name, {player.sid: player.rating})
        if ret == 1:
            lgr.info(f"Added player {player.sid} to pool {search_pool_name}")
        else:
            lgr.info(f"Player {player.sid} already exists in pool {search_pool_name}")
        thread = Thread(target=self.search, args=(player,))
        thread.start()

    def search(self, player: Player):
        loop_round = 0
        search_pool_name = f"search_pool_{player.preferences['time_control'].split('+')[0]}"
        try:
            while loop_round < 6:    # up to six rounds
                rival_sid = self.script(keys=[search_pool_name,
                                              player.rating - 100,
                                              player.rating + 100,
                                              player.sid
                                              ],
                                        args=[],
                                        client=self.redis_plug.redis)

                if rival_sid == 0:   # Own player not found. Already matched
                    lgr.info(f"Someone else matched our player {player.sid}. We can safely abandon search")
                    return None
                elif rival_sid == 1:  # Own player found. Keep trying
                    lgr.info("No match found. Yet...")
                else:
                    lgr.info(f"The match returned {rival_sid} for {player.sid}")
                    res = requests.get(url="http://localhost:5000/match/" + player.sid + "/" + rival_sid,
                                       json={'time_control': get_millis_for_time_control(player.preferences['time_control'])})
                    lgr.info(f"Sending match resulted in: {res.text}")
                    if res.status_code != 200:
                        raise Exception(f'Sending match failed with {res.status_code}: {res.reason}')
                    return None
                loop_round += 1
                time.sleep(1)

            ret = self.redis_plug.remove_players_from_search_pool(search_pool_name, player.sid)
            lgr.info(f"Search yielded no results so matching with engine. Removed player from search pool: {ret == 1}")
            if ret == 1:
                res = requests.get(url="http://localhost:5000/match/" + player.sid + "/@",
                                   json={'time_control': get_millis_for_time_control('30+0')})
                lgr.info(f"Sending match resulted in: {res.text}")
                if res.status_code != 200:
                    raise Exception(f'Sending match failed with {res.status_code}: {res.reason}')
            else:
                lgr.info("At the last moment, someone else matched our player. Happily exiting")
                return None
        except Exception as e:
            lgr.error(f"Error in searching match: {e}")
