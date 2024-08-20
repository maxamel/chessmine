FROM python:3.8

WORKDIR /usr/app/

COPY src/backend/sanicfish .

RUN pip install -r ./requirements.txt
RUN apt-get update
RUN apt-get install stockfish

RUN useradd user
USER user
HEALTHCHECK CMD curl --fail http://localhost:8040 || exit 1

CMD [ "python", "./src/sanicfish.py" ]
