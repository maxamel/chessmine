import hashlib

from redis_plug import RedisPlug


class Alerter:
    def __init__(self):
        self.redis_plug = RedisPlug()

    def alert(self, player):
        pass

    def dedup(self, message: str) -> bool:
        '''
        :param message: string of alert message to deduplicate
        :return: succeeded in setting dedup key. If False, it means message was deduped so do not send!
        '''
        alert_uuid = hashlib.sha256(message.encode()).hexdigest()
        return self.redis_plug.alert_dedup(alert_uuid)
