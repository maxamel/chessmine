FROM python:3.9

WORKDIR /usr/app/

COPY src/backend/game_server .

RUN pip install -r requirements.txt

RUN useradd user
USER user
HEALTHCHECK CMD curl --fail http://localhost:5000 || exit 1

CMD [ "python", "./src/app.py" ]