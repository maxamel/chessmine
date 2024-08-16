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
docker compose down --rmi local
```
### Debug game server locally
```
docker compose -f docker-compose-debug-gs.yml up -d --build --force-recreate
```
Next run game server from IDE with env var: REDIS_URL=localhost.
It should be able to communicate with the containers started by the docker compose.
