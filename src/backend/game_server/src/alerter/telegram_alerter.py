from alerter.alerter import Alerter
from logger import get_logger

import requests


lgr = get_logger(prefix="TelegramAlerter", path="/var/log/server.log")


class TelegramAlerter(Alerter):
    def __init__(self, bot_token: str, chat_id: str):
        self.bot_token = bot_token
        self.chat_id = chat_id
        self.url = f"https://api.telegram.org/bot{bot_token}/sendMessage"

    def alert(self, msg: str):
        not_deduped = super().dedup(msg)
        if not_deduped:
            lgr.info(f"Sending alert {msg}")
            payload = {"chat_id": self.chat_id, "text": msg}
            response = requests.post(self.url, data=payload)
            return response.json()