import logging
import time
import requests
from threading import Thread

from matcher.matcher import Matcher
from player import Player
from redis_plug import RedisPlug
from util import get_millis_for_time_control


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
            logging.info(f"Added player {player.sid} to pool {search_pool_name}")
        else:
            logging.info(f"Player {player.sid} already exists in pool {search_pool_name}")
        thread = Thread(target=self.search, args=(player,))
        thread.start()
        thread.join()

    def search(self, player: Player):
        loop_round = 0
        search_pool_name = f"search_pool_{player.preferences['time_control'].split('+')[0]}"
        while loop_round < 6:    # up to six rounds
            rival_sid = self.script(keys=[search_pool_name,
                                          player.rating - 100,
                                          player.rating + 100,
                                          player.sid
                                          ],
                                    args=[],
                                    client=self.redis_plug.r)
            if rival_sid == 0:   # Own player not found. Already matched
                logging.info("Someone else matched our player. We can safely abandon search")
                return None
            elif rival_sid == 1:  # Own player found. Keep trying
                logging.info("No match found. Yet...")
            else:                    # Success
                requests.get(url="http://localhost:5000/match/" + player.sid + "/" + rival_sid,
                             json={'time_control': get_millis_for_time_control(player.preferences['time_control'])})
                return None
            loop_round += 1
            time.sleep(1)

        ret = self.redis_plug.remove_players_from_search_pool(search_pool_name, player.sid)
        logging.info(f"Search yielded no results so matching with engine. Removed player from search pool: {ret == 1}")
        if ret == 1:
            requests.get(url="http://localhost:5000/match/" + player.sid + "/@",
                         json={'time_control': get_millis_for_time_control('30+0')})
        else:
            logging.info("At the last moment, someone else matched our player. Happily exiting")
            return None