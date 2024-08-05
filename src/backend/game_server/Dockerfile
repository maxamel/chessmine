FROM python:3.9

WORKDIR /usr/app/

ADD src/backend/game_server .

RUN pip install -r requirements.txt

CMD [ "python", "./src/app.py" ]