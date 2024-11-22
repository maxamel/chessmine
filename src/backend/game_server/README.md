# Run local game server

### Prerequisites:

docker, python3.9+, pip

### Run all required containers:

```
docker compose -f docker-compose-debug-gs.yml up -d --build --force-recreate
```

### Run the game server locally inside virtual env
```
python -m venv .
source ./bin/activate
pip install -r requirements.txt
REDIS_URL=localhost LOG_PATH=server.log python src/app.py
```

This should start the game_server on localhost:5000.

# Run tests

### Prerequisites:

pip, python3.9+. Containers game_server, redis and operator up and running.

### Run test from inside virtual env
```
python -m venv .
source ./bin/activate
pip install -r requirements.txt
pip install websocket-client
cd test/
python -m unittest discover -v -s ./  -p 'test_*.py'
```
