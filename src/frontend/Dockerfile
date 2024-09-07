FROM caddy:2.8.4-alpine

WORKDIR /var/www/html/
ARG APP_URL
ARG BE_URL
ENV APP_URL=$APP_URL
ENV BE_URL=$BE_URL
COPY src/frontend/ /var/www/html/
RUN sed -i "s#APP_URL#${APP_URL}#g" /var/www/html/static/js/settings.js  # for dynamic config of url
RUN sed -i "s#APP_URL#${APP_URL}#g" /var/www/html/static/js/game.js      # for dynamic config of url
RUN apk add npm minify acl curl && npm install
RUN cp /var/www/html/node_modules/chess.js/dist/cjs/chess.js /var/www/html/static/js/chess.js && \
    cp /var/www/html/node_modules/stockfish/src/stockfish* /var/www/html/static/js/
RUN minify -o /var/www/html/static/js/chess.min.js /var/www/html/static/js/chess.js && \
    minify -o /var/www/html/static/js/chessboard-1.0.0.min.js /var/www/html/static/js/chessboard-1.0.0.js
RUN cp /var/www/html/Caddyfile /etc/caddy/Caddyfile


RUN adduser -D user wheel
RUN setfacl -Rdm u:user:rwx /etc/caddy/ && setfacl -Rdm u:user:rwx /data/caddy/ && setfacl -Rdm u:user:rwx /config/caddy/
RUN chown -hR user /etc/caddy/ && chown -hR user /data/caddy/ && chown -hR user /config/caddy/ && chown -hR user /var/log/
USER user
HEALTHCHECK CMD curl --fail $APP_URL || exit 1