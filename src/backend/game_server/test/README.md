# Backend tests

## Running load test


### Prerequisites:

pip, python3.9+, ssh

In case using dedicated machine to run tests, transfer the files from game_server/test/ to the remote machine:
scp -r . user@domain:~/

### Install pip and nano

This step assumes a fresh alpine linux machine but similar commands should apply for other flavours.

```
apk add --update py-pip
apk add nano
apk add openssh-client
```

### Setup SSH tunnel to redis from the test machine to the machine where Chessmine is running

ssh -L 6379:localhost:6379 user@chessmineDomain


From inside load_test directory run:
### Run load test inside virtual env
```
python -m venv .
source ./bin/activate
pip install -r ../requirements.txt
python load_test_wrapper.py
```


## Running component tests

### Prerequisites

- Docker with Compose V2 (`docker compose`)
- Python 3.9+ with dependencies installed:
  ```
  pip install -r requirements.txt websocket-client
  ```

### Start the dev stack with test ports exposed

Services do not expose ports by default. Use the test compose override to open
Redis (`6379`) and the game server (`5000`) on localhost:

```
cd src/ops/
docker compose -f docker-compose-dev.yml -f docker-compose-test.yml up -d
```

Wait until all containers are healthy:

```
docker compose -f docker-compose-dev.yml -f docker-compose-test.yml ps
```

### Run the tests

From inside the `src/backend/game_server/` directory, run the tests with `REDIS_PASSWORD`
set to the dev password:

```
REDIS_PASSWORD=changeme python -m unittest discover -v -s test/ -p 'test_*.py'
```

On Windows (PowerShell):

```
$env:REDIS_PASSWORD="changeme"; python -m unittest discover -v -s test/ -p 'test_*.py'
```

### Tear down

```
docker compose -f docker-compose-dev.yml -f docker-compose-test.yml down
```
