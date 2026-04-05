FROM redis:7.4.1-alpine3.20
COPY redis.conf /usr/local/etc/redis/redis.conf

USER redis

HEALTHCHECK CMD REDISCLI_AUTH="$REDIS_PASSWORD" redis-cli ping || exit 1
CMD [ "redis-server", "/usr/local/etc/redis/redis.conf" ]