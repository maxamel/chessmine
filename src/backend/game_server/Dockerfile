FROM python:3.9-alpine

WORKDIR /usr/app/

COPY src/backend/game_server .

RUN pip install -r requirements.txt

RUN adduser -D user wheel
USER user
HEALTHCHECK CMD curl --fail http://localhost:5000 || exit 1

CMD [ "python", "./src/app.py" ]