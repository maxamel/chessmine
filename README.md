# Chessmine

Free and open source chess server.

[www.chessmine.xyz](https://www.chessmine.xyz)

![](https://github.com/maxamel/chessmine/blob/e65719c4bd27c27866846dbc7e3d50ce2936351e/chess.gif)


[![buddy pipeline](https://app.buddy.works/maxamel2002/chessmine/pipelines/pipeline/502243/badge.svg?token=d2e020fd6a283d05141a0ed9fccce4c84fb103b93cc3f7559091e5ef4e6fb8cd "buddy pipeline")](https://app.buddy.works/maxamel2002/chessmine/pipelines/pipeline/502243)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
![](https://sloc.xyz/github/maxamel/chessmine)


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
docker compose -f docker-compose-dev.yml up -d --build --force-recreate
```
### Build specific container:
```
docker compose build --no-cache <container>
```

### Stop running application:
```
docker rmi $(docker images -f "dangling=true" -q)
docker compose -f docker-compose-dev.yml down --rmi local
```
### Debug game server locally
```
docker compose -f docker-compose-debug-gs.yml up -d --build --force-recreate
```
Next run game server from IDE with env vars: REDIS_URL=localhost, LOG_PATH=server.log.
It would be able to communicate with the containers started by the docker compose.

### Run caddy from master

Build caddy image with dockerfile that builds from source:
```
docker build -f DockerfileCaddyMaster -t caddy_master --build-arg APP_URL=http://localhost --build-arg BE_URL=host.docker.internal .
```
Next run the docker compose which spins all containers but caddy:
```
docker compose -f docker-compose-debug-caddy.yml up -d --build --force-recreate
```
Finally run the image we built for caddy and expose port 80:
docker run -p 80:80 -it caddy_master caddy/cmd/caddy/caddy run --config Caddyfile
