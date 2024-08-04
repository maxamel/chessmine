FROM caddy:2.8.4-alpine

WORKDIR /var/www/html/
ARG APP_URL
ARG BE_URL
ENV APP_URL=$APP_URL
ENV BE_URL=$BE_URL
ADD src/frontend/ /var/www/html/
RUN sed -i "s#APP_URL#${APP_URL}#g" /var/www/html/static/js/settings.js  # for dynamic config of url
RUN sed -i "s#APP_URL#${APP_URL}#g" /var/www/html/static/js/game.js      # for dynamic config of url
RUN apk add npm && npm install && apk add minify
RUN cp /var/www/html/node_modules/chess.js/dist/cjs/chess.js /var/www/html/static/js/chess.js && \
    cp /var/www/html/node_modules/@chrisoakman/chessboardjs/dist/chessboard-1.0.0.min.css /var/www/html/static/css/chessboard-1.0.0.min.css && \
    cp /var/www/html/node_modules/@chrisoakman/chessboardjs/dist/chessboard-1.0.0.min.js /var/www/html/static/js/chessboard-1.0.0.min.js
RUN minify -o /var/www/html/static/js/chess.min.js /var/www/html/static/js/chess.js

RUN cp /var/www/html/Caddyfile /etc/caddy/Caddyfile
