from logger import get_logger

import maxminddb

lgr = get_logger(prefix="geo_ip_looker", path="/var/log/server.log")


class GeoIpLookup:

    def __init__(self):
        self.mmdb_path = "src/GeoLite2-Country.mmdb"

    def lookup_mmdb(self, ip_address: str):
        """
        Lookup country code using MaxMind MMDB file instead of API calls.
        
        :param ip_address: IP address to lookup
        :param mmdb_path: Path to the MaxMind MMDB file
        :return: ISO country code or None
        """
        if not ip_address or ip_address == "127.0.0.1" or ip_address.startswith("192.168."):
            lgr.debug(f"Skipping geo lookup for local IP: {ip_address}")
            return None

        try:
            
            lgr.info(f"Querying MMDB for IP: {ip_address}")
            with maxminddb.open_database(self.mmdb_path) as reader:
                result = reader.get(ip_address)
                
                if result and 'country' in result and 'iso_code' in result['country']:
                    country_code = result['country']['iso_code']
                    lgr.info(f"MMDB lookup success for {ip_address}: {country_code}")
                    return country_code
                else:
                    lgr.warning(f"No country data found in MMDB for IP {ip_address}")
                    return None

        except FileNotFoundError:
            lgr.error(f"MMDB file not found at {self.mmdb_path}")
            return None
        except Exception as e:
            lgr.error(f"MMDB lookup error for IP {ip_address}: {e}")
            return None
