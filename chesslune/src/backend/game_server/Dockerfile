FROM python:3.8

WORKDIR /usr/app/

ADD src/backend/game_server .

RUN pip install -r requirements.txt

RUN echo "$(ls -la)"

CMD [ "python", "./src/app.py" ]