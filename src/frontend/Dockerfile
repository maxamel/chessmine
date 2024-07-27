FROM caddy:2.8.4-alpine

ENV APP_URL=http://localhost
ADD src/frontend/ /var/www/html/
RUN sed -i "s#APP_URL#${APP_URL}#g" /var/www/html/static/js/settings.js  # for dynamic config of url
RUN sed -i "s#APP_URL#${APP_URL}#g" /var/www/html/static/js/game.js      # for dynamic config of url

RUN cp /var/www/html/Caddyfile /etc/caddy/Caddyfile
