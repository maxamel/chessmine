import requests

from logger import get_logger
from redis_plug import RedisPlug

lgr = get_logger(prefix="geo_ip_looker", path="/var/log/server.log")
GEO_CACHE_TTL = 86400  # 24 hours


class GeoIpLookup:

    def __init__(self):
        self.redis = RedisPlug()

    def lookup(self, ip_address: str):
        if not ip_address or ip_address == "127.0.0.1" or ip_address.startswith("192.168."):
            lgr.debug(f"Skipping geo lookup for local IP: {ip_address}")
            return None
        # Check Redis cache first
        cached_country = self.redis.get_geo_ip(ip_address)

        if cached_country:
            lgr.debug(f"Cache hit for IP {ip_address}: {cached_country}")
            return cached_country

        # Cache miss - query API
        try:
            lgr.info(f"Querying geo API for IP: {ip_address}")
            response = requests.get(f"https://ipapi.co/{ip_address}/country/", timeout=3)

            if response.status_code == 200:
                country_code = response.text.strip()

                # Validate it's a 2-letter code
                if len(country_code) == 2 and country_code.isalpha():
                    # Store in Redis with TTL
                    self.redis.set_geo_ip(ip_address, country_code)
                    lgr.info(f"Geo lookup success for {ip_address}: {country_code}")
                    return country_code
                else:
                    lgr.warning(f"Invalid country code received: {country_code}")
                    return None
            elif response.status_code == 429:
                lgr.warning(f"Geo API rate limit exceeded for IP {ip_address}. Caching 'XX' as placeholder.")
                # Cache a placeholder to avoid repeated failed API calls
                return None
            else:
                lgr.warning(f"Geo API returned status {response.status_code} for IP {ip_address}")
                return None

        except requests.exceptions.Timeout:
            lgr.error(f"Geo API timeout for IP {ip_address}")
            return None
        except Exception as e:
            lgr.error(f"Geo lookup error for IP {ip_address}: {e}")
            return None