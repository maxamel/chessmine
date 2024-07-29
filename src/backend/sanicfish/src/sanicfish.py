import os, sys

from sanic import Sanic
from sanic.response import json
from stockfish import Stockfish

app = Sanic(name="sanicfish")
try:
    STOCKFISH_PATH = os.environ['STOCKFISH_PATH']

except KeyError:
   print("Please set the environment variable FOO")
   sys.exit(1)

stockfish = Stockfish(path="/usr/games/stockfish",
                      depth=5,
                      parameters={"Write Debug Log": "true",
                                  "Minimum Thinking Time": 2,
                                  "Threads": 4})


@app.route('/')
async def test(request):
    return json({'hello': 'world'})


@app.route('/set_position', methods=["POST"])
async def set_position(request):
    stockfish.set_position(request.json["position"])


@app.route('/set_fen_position', methods=["POST"])
async def set_fen_position(request):
    stockfish.set_fen_position(request.json["fen_position"])


@app.route('/get_best_move')
async def get_best_move(request):
    return stockfish.get_best_move()


@app.route('/set_skill_level', methods=["POST"])
async def set_skill_level(request):
    stockfish.set_skill_level(int(request.json["skill"]))


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8040)
