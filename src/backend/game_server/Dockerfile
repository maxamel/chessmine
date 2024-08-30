FROM python:3.9-alpine

WORKDIR /usr/app/

COPY src/backend/game_server .

RUN apk add acl curl
RUN pip install -r requirements.txt

RUN adduser -D game
RUN setfacl -Rdm u:game:rwx /usr/app/
RUN setfacl -Rdm u:game:rwx /var/log/
RUN chown -hR game /usr/app/ && chown -hR game /var/log/
USER game
HEALTHCHECK CMD curl --fail http://localhost:5000/healthcheck || exit 1

CMD [ "python", "./src/app.py" ]
