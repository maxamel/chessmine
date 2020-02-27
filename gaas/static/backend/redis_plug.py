import redis


class RedisPlug:

    def __init__(self):
        self.redis_url = "localhost"
        self.redis_port = "6379"
        self.search_pool = "search_pool"
        self.r = redis.Redis(host=self.redis_url, port=self.redis_port, db=0, decode_responses=True)

    def add_player_to_search_pool(self, player_sid):
        self.r.sadd(self.search_pool, player_sid)

    def draw_player_from_search_pool(self) -> str:
        '''
        :return: sid of a random player
        '''
        return self.r.srandmember(self.search_pool)

    def remove_players_from_search_pool(self, *player_sids):
        return self.r.srem(self.search_pool, *player_sids)

    def is_player_in_search_pool(self, player_sid):
        return self.r.sismember(self.search_pool, player_sid)

    def set_game(self, game_id, player1, player2):
        pass

    def get_redis(self):
        return self.r
