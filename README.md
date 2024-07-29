

### Local Development:

Chessmine runs in docker containers setup using docker-compose.

# Prerequisites:

pip, python3.9, npm, docker-compose

# Create python virtual environment:

python3.9 -m venv chessmine
source chessmine/bin/activate

# Install dependencies:
pip install src/backend/game_server/requirements.txt
npm install --prefix src/frontend

# Run:
docker compose up -d --build --force-recreate