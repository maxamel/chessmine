FROM redis:7.4.1-alpine3.20
COPY redis.conf /usr/local/etc/redis/redis.conf

RUN adduser -D game
USER game

HEALTHCHECK CMD redis-cli ping || exit 1
CMD [ "redis-server", "/usr/local/etc/redis/redis.conf" ]