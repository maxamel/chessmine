#!/usr/bin/env python3
"""
Kuma bootstrap — idempotently provisions all Uptime Kuma monitors and
notification channels from environment variables.  Safe to run on every deploy
and on a completely fresh volume (e.g. after a server migration).

All values that other services depend on (push tokens, Telegram credentials)
are injected as environment variables, so this script is fully deterministic:
the same env vars always produce the same Kuma configuration, with zero
manual steps.

In dev the bootstrap runs with Telegram vars left empty, so monitors are
created and visible in the Kuma UI but no external notifications are sent.

Required env vars:
  KUMA_USERNAME               admin username to create / log in with
  KUMA_PASSWORD               admin password
  APP_HOST                    bare hostname[:port], e.g. chessmine.xyz

Optional env vars:
  KUMA_URL                    Kuma base URL (default: http://uptime-kuma:3001)
  APP_SCHEME                  https | http (default: https)
  APP_MONITOR_URL             Full URL Kuma uses for the HTTP liveness check.
                              Defaults to APP_SCHEME://APP_HOST/healthcheck.
                              Override to avoid TLS SNI mismatch / hairpin-NAT:
                                http://caddy:2019/config/
                              Caddy's admin API is plain HTTP, always reachable
                              from inside Docker regardless of TLS cert setup.
  ENABLE_TLS_MONITOR          "true" to create a TLS-expiry monitor (prod only)
  TELEGRAM_BOT_TOKEN          Telegram bot token — omit to disable notifications
  TELEGRAM_CHAT_ID            Telegram chat ID  — omit to disable notifications
  KUMA_SANITY_PUSH_TOKEN      UUID for the periodic sanity-test push monitor;
                              omit to skip creating that monitor
  KUMA_BACKEND_PUSH_TOKEN     UUID for the backend alerts push monitor;
                              omit to skip creating that monitor
"""

import logging
import os
import sys

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-7s %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("kuma-bootstrap")

try:
    from uptime_kuma_api import UptimeKumaApi, MonitorType, NotificationType
except ImportError:
    log.error("uptime-kuma-api not installed")
    sys.exit(1)

# ---------------------------------------------------------------------------
# Config from environment
# ---------------------------------------------------------------------------
KUMA_URL = os.environ.get("KUMA_URL", "http://uptime-kuma:3001")
KUMA_USERNAME = os.environ["KUMA_USERNAME"]
KUMA_PASSWORD = os.environ["KUMA_PASSWORD"]
APP_HOST = os.environ["APP_HOST"]
APP_SCHEME = os.environ.get("APP_SCHEME", "https")
ENABLE_TLS_MONITOR = os.environ.get("ENABLE_TLS_MONITOR", "false").lower() == "true"
TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID", "")
# Internal hostname Kuma uses to reach the app (defaults to APP_HOST).
# In dev, APP_HOST is "localhost:1443" which resolves to the Kuma container
# itself — override with the Docker service name so the check actually works.
# URL Kuma uses for the HTTP liveness check.  Defaults to APP_URL/healthcheck
# (works if the public hostname is reachable from inside Docker), but should
# be overridden to Caddy's plain-HTTP admin probe in all environments to
# avoid TLS SNI mismatch (cert is for the public hostname, not "caddy") and
# hairpin-NAT reliability issues on the host.
# Use: http://caddy:2019/config/  — Caddy admin API, plain HTTP, always up.
APP_MONITOR_URL = os.environ.get(
    "APP_MONITOR_URL",
    f"{APP_SCHEME}://{APP_HOST}/healthcheck",
)

# Pre-defined push tokens — generated once and stored as GitHub Secrets
# (prod) or committed dev UUIDs (.env).  Kuma uses them as-is, so push URLs
# are stable across any redeploy.  Empty = skip that monitor (logs a warning).
CHECKMATE_PUSH_TOKEN = os.environ.get("KUMA_SANITY_PUSH_TOKEN", "")
# Single token for ALL backend code alerts — add new alert sites freely
# without ever needing a new secret or a new Kuma monitor.
BACKEND_PUSH_TOKEN = os.environ.get("KUMA_BACKEND_PUSH_TOKEN", "")

APP_URL = f"{APP_SCHEME}://{APP_HOST}"
IS_LOCAL = APP_HOST.startswith("localhost") or APP_HOST.startswith("127.")

# Checkmate runs every 4 h; allow 30 min grace window before alerting.
CHECKMATE_HEARTBEAT_SECS = 4 * 3600 + 1800
# Illegal-move monitor is event-driven; use Kuma's maximum allowed interval
# (24 days) so it only flips DOWN if the server is completely dead, not quiet.
ILLEGAL_HEARTBEAT_SECS = 2_073_600  # 24 days — Kuma's hard cap


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def get_monitors(api: UptimeKumaApi) -> dict:
    """Return {name: monitor_dict} for all current monitors."""
    return {m["name"]: m for m in api.get_monitors()}


def get_notifications(api: UptimeKumaApi) -> dict:
    """Return {name: notif_dict} for all current notification channels."""
    return {n["name"]: n for n in api.get_notifications()}


def ensure_monitor(api: UptimeKumaApi, monitors: dict, name: str,
                   push_token: str = None, **kwargs) -> None:
    """Create the monitor if it doesn't exist; update pushToken if it drifted.

    push_token is handled separately because the library's add_monitor()
    does not accept pushToken — it auto-generates one.  We set/correct it
    immediately afterwards via edit_monitor(), which merges kwargs into the
    full existing record and therefore accepts pushToken just fine.
    """
    if name not in monitors:
        result = api.add_monitor(name=name, **kwargs)
        monitor_id = result["monitorID"]
        if push_token:
            api.edit_monitor(monitor_id, pushToken=push_token)
        log.info("Created monitor: '%s'", name)
    else:
        existing = monitors[name]
        if push_token and existing.get("pushToken") != push_token:
            # Token drifted (e.g. migrated from non-deterministic setup).
            api.edit_monitor(existing["id"], pushToken=push_token)
            log.info("Updated pushToken for monitor: '%s'", name)
        else:
            log.info("Monitor already up to date: '%s'", name)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    api = UptimeKumaApi(KUMA_URL)

    # First-time account setup.  "userExist" is the normal already-configured
    # message; any other error (e.g. weak password) is a real failure.
    try:
        api.setup(KUMA_USERNAME, KUMA_PASSWORD)
        log.info("Kuma initial setup complete")
    except Exception as exc:
        msg = str(exc)
        if "userExist" in msg or "already" in msg.lower():
            log.info("Setup skipped (already configured)")
        else:
            log.error("Kuma setup failed: %s", msg)
            sys.exit(1)

    api.login(KUMA_USERNAME, KUMA_PASSWORD)
    log.info("Logged in as '%s'", KUMA_USERNAME)

    # Global settings: alert 14 days before TLS expiry.
    # tlsExpiryNotifyDays expects a list of day thresholds, not a scalar.
    try:
        api.set_settings(tlsExpiryNotifyDays=[14])
        log.info("Global TLS expiry threshold set to 14 days")
    except Exception as exc:
        log.warning("Could not apply global settings: %s", exc)

    # ------------------------------------------------------------------
    # Notification channel
    # ------------------------------------------------------------------
    notification_id = None
    if TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID:
        notifs = get_notifications(api)
        if "Telegram" not in notifs:
            result = api.add_notification(
                type=NotificationType.TELEGRAM,
                name="Telegram",
                isDefault=True,
                applyExisting=True,
                telegramBotToken=TELEGRAM_BOT_TOKEN,
                telegramChatID=TELEGRAM_CHAT_ID,
                telegramSendSilently=False,
            )
            notification_id = result.get("id")
            log.info("Created Telegram notification channel (id=%s)", notification_id)
        else:
            notification_id = notifs["Telegram"]["id"]
            log.info("Telegram notification already exists (id=%s)", notification_id)
    else:
        log.warning("TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID not set — no notification channel")

    notif_list = {notification_id: True} if notification_id else {}

    # ------------------------------------------------------------------
    # Monitors
    # ------------------------------------------------------------------
    monitors = get_monitors(api)

    # 1. HTTP liveness check.  APP_MONITOR_URL points at Caddy's plain-HTTP
    #    admin API (http://caddy:2019/config/) so Kuma never has to deal with
    #    TLS SNI mismatch or hairpin-NAT to the public hostname.
    ensure_monitor(
        api, monitors,
        name=f"HTTP {APP_HOST}",
        type=MonitorType.HTTP,
        url=APP_MONITOR_URL,
        interval=60,
        retryInterval=60,
        maxretries=3,
        notificationIDList=notif_list,
        ignoreTls=IS_LOCAL,
    )

    # 2. TLS expiry check (prod only; dev uses a self-signed cert)
    if ENABLE_TLS_MONITOR:
        ensure_monitor(
            api, monitors,
            name=f"TLS {APP_HOST}",
            type=MonitorType.HTTP,
            url=f"https://{APP_HOST}",
            interval=3600,
            retryInterval=3600,
            maxretries=1,
            notificationIDList=notif_list,
            certExpiryNotification=True,
        )

    # 3. Checkmate push monitor (GitHub Actions reports up/down every 4 h).
    #    Push token is pre-defined so the push URL is stable across redeployments.
    if CHECKMATE_PUSH_TOKEN:
        ensure_monitor(
            api, monitors,
            name="Checkmate Test",
            type=MonitorType.PUSH,
            push_token=CHECKMATE_PUSH_TOKEN,
            interval=CHECKMATE_HEARTBEAT_SECS,
            retryInterval=300,
            maxretries=1,
            notificationIDList=notif_list,
        )
    else:
        log.warning("KUMA_SANITY_PUSH_TOKEN not set — skipping Checkmate Test monitor")

    # 4. Single monitor for all backend code alerts (illegal moves, aborts, etc.).
    #    One token covers every current and future alert type from code — no new
    #    secrets or monitors needed when adding a new kuma_alert.push() call.
    if BACKEND_PUSH_TOKEN:
        ensure_monitor(
            api, monitors,
            name="Backend Alerts",
            type=MonitorType.PUSH,
            push_token=BACKEND_PUSH_TOKEN,
            interval=ILLEGAL_HEARTBEAT_SECS,
            retryInterval=300,
            maxretries=0,
            notificationIDList=notif_list,
        )
    else:
        log.warning("KUMA_BACKEND_PUSH_TOKEN not set — skipping Backend Alerts monitor")

    api.disconnect()
    log.info("Bootstrap complete — all monitors are up to date")


if __name__ == "__main__":
    main()
