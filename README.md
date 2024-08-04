

# Local Development:

Chessmine runs in docker containers setup using docker-compose.

### Prerequisites:

pip, python3.9, npm, docker-compose

### Create python virtual environment:
```
python3.9 -m venv chessmine
source chessmine/bin/activate
```
### Install dependencies:
```
pip install src/backend/game_server/requirements.txt
npm install --prefix src/frontend
```
### Run all containers:
```
docker compose up -d --build --force-recreate
```
### Build specific container:
```
docker compose build --no-cache <container>
```

### Stop running application:
```
docker rmi $(docker images -f "dangling=true" -q)
docker compose down --rmi local
```
### Debug game server locally
```
docker compose -f docker-compose-local.yml up -d --build --force-recreate
```
Next run game server from IDE with env var: REDIS_URL=localhost.
It should be able to communicate with the containers started by the docker compose.