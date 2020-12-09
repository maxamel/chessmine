import multiprocessing
import time

from redis_plug import RedisPlug


class EndGameHandler(multiprocessing.Process):

    def __init__(self):
        super().__init__()
        self.redis = RedisPlug()

    def work(self):
        try:
            while True:
                print("WISCONSIN")
                res = self.redis.peek_game_timeouts()
                if not res:
                    time.sleep(1)
                print(res)
        except Exception as e:
            print(e)

    def run(self):
        # Run one thread for now
        '''
        all_threads = []
        t = threading.Thread(target=self.work)
        t.start()
        all_threads.append(t)
        t.join()
        print("HELLO")
        '''

