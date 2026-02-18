# Run local game server

### Prerequisites:

docker, python3.9+, pip

### Run all required containers except the game_server:

```
docker compose -f docker-compose-debug-gs.yml up -d --build --force-recreate
```

### Run the game server locally inside virtual env
```
cd backend/game_server
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

Note the tests require a game_server instance listening on localhost:5000. If you run the entire dockerized app with:
`docker compose -f docker-compose-dev.yml up` you won't be able to run tests since localhost:5000 won't be exposed and
the result will be connection error.
