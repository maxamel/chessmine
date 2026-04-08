import os
import threading
import time

import requests

from logger import get_logger

lgr = get_logger(prefix="kuma_alert", path="/var/log/server.log")

_DEDUPE_SECS: int = int(os.getenv("KUMA_ALERT_DEDUPE_SECS", "3600"))
# Single push URL for all backend alerts — set via KUMA_PUSH_URL env var.
# All alert sites share this; differentiated only by event_key / msg.
_DEFAULT_PUSH_URL: str = os.getenv("KUMA_PUSH_URL", "")
_last_sent: dict[str, float] = {}
_lock = threading.Lock()


def push(msg: str = "", status: str = "down", event_key: str = "default",
         push_url: str = "") -> None:
    """Fire-and-forget push to the shared Kuma Backend Alerts monitor.

    - msg: short human-readable message shown in Kuma (describe the event)
    - status: "up" or "down"
    - event_key: dedupe key — repeat calls with the same key within
        KUMA_ALERT_DEDUPE_SECS (default 3600s) are silently dropped.
    - push_url: override the module-level default (rarely needed).

    The HTTP call is made in a daemon thread so it never blocks the caller.
    If no URL is configured the call is a silent no-op.
    """
    url = push_url or _DEFAULT_PUSH_URL
    if not url:
        return

    now = time.monotonic()
    with _lock:
        if now - _last_sent.get(event_key, 0.0) < _DEDUPE_SECS:
            lgr.debug("kuma push suppressed for '%s' (dedupe %ss)", event_key, _DEDUPE_SECS)
            return
        _last_sent[event_key] = now

    def _send() -> None:
        try:
            resp = requests.get(
                url,
                params={"status": status, "msg": msg, "ping": ""},
                timeout=5,
            )
            lgr.info("kuma push sent: event=%s status=%s http=%s", event_key, status, resp.status_code)
        except Exception as exc:
            lgr.warning("kuma push failed for '%s': %s", event_key, exc)

    threading.Thread(target=_send, daemon=True).start()
