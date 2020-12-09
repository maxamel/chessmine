FROM python:3.8

WORKDIR /usr/app/

ADD src/backend/sanicfish .

RUN pip install -r ./requirements.txt
RUN apt-get update
RUN apt-get install stockfish

CMD [ "python", "./src/sanicfish.py" ]