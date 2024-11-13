# Examples

Running a playground environment with minimal components to test out websocket connections the same way they are used in Chessmine.

### Prerequisites:

pip, python3.9+, docker

In case using dedicated machine to run this playground, transfer the files from examples/ to the remote machine:
scp -r . user@domain:~/

### Install and run docker

This step assumes a fresh alpine linux machine but similar commands should apply for other flavours.

```
apk add --update py-pip
apk add docker
service docker start
```
### Build and run the reverse proxy
```
docker build -t rev_proxy .
docker run -p 80:80 --network host --add-host=host.docker.internal:host-gateway -it rev_proxy go run .
```

The previous should block and wait for connection. On a different terminal:

### Run flask socketio server inside virtual env
```
python3 -m venv .
source ./bin/activate
pip install -r requirements.txt
python3 example_server.py
```

The previous should block and wait for connection. On yet another different terminal:

### Check HTTP connectivity
```
curl http://localhost/hello
```

### Invoke websocket connection from virtual env
```
python3 -m venv .
source ./bin/activate
python3 example_client.py
```

The above commands should output Hello.

If something doesn't work, the culprit could very well be the connectivity between the proxy and the server.
Try changing the URL of the example_client.py to localhost:5000 to access the server directly. This will help
rule out an issue with the client or server. If it works, it's probably the proxy, so you should get inside the
container and check if it host.docker.internal:5000/hello is accessible.