FROM python:3.9-alpine

WORKDIR /usr/app/

COPY src/backend/game_server .

RUN apk add acl
RUN pip install -r requirements.txt

RUN adduser -D user wheel
RUN setfacl -Rdm u:user:rwx /usr/app/
RUN chown -hR user /usr/app/ && chown -hR user /var/log/
USER user
HEALTHCHECK CMD curl --fail http://localhost:5000 || exit 1

CMD [ "python", "./src/app.py" ]