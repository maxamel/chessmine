

Run Chess Server:

Create python virtual environment:

python3.9 -m venv chessmine
source chessmine/bin/activate

Install python dependencies:
pip install src/backend/game_server/requirements.txt

Run everything:
docker builder prune -a
docker compose up -d --build --force-recreate