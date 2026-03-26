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


### Prerequisites:

pip, python3.9+, game server running on localhost:5000, redis running on localhost:6379

In case using dedicated machine to run tests, transfer the files from *game_server/* to the remote machine:
scp -r . user@domain:~/

### Install pip, redis and nano

This step assumes a fresh alpine linux machine but similar commands should apply for other flavours.

### Running the application in server debug mode (from src/ops directory)

```
sh spin_up.sh debug-gs hard
```


```
apk add --update py-pip
apk add nano
apk add redis
```

### Run game_server in the background inside virtual env

```
python -m venv .
source ./bin/activate
pip install -r requirements.txt
REDIS_URL="localhost" LOG_PATH=server.log python src/app.py &
```

From inside tests directory run:
### Run test inside virtual env
```
python -m unittest discover -v -s ./  -p 'test_*.py'
```