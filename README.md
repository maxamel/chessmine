# Chessmine

Simple, minimalist, free and open source chess server.

[www.chessmine.xyz](https://www.chessmine.xyz)

![](https://github.com/maxamel/chessmine/blob/e65719c4bd27c27866846dbc7e3d50ce2936351e/chess.gif)


[![buddy pipeline](https://app.buddy.works/maxamel2002/chessmine/pipelines/pipeline/502243/badge.svg?token=d2e020fd6a283d05141a0ed9fccce4c84fb103b93cc3f7559091e5ef4e6fb8cd "buddy pipeline")](https://app.buddy.works/maxamel2002/chessmine/pipelines/pipeline/502243)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
![](https://sloc.xyz/github/maxamel/chessmine)


## Introduction

The main goal of the project is to provide a lightweight, hassle-free and minimalist chess experience with basic functionality, whilst keeping it free and open for everyone. 
This means no overload of features, intuitive and simple design, and no heavy infrastructure. The simpler - the better.
The tech stack is mainly Docker, Python, JS, Redis, Lua and Caddy.


## Local Run

The simplest way to run a minimal installation of the service is by running the script in *src/ops/spin_dev.sh* which will spin up all required dev containers.
It expects an argument for the kind of setup to run, currently it supports:
- dev (for all containers)
- debug-gs (for all containers except game server)
- debug-caddy (for all containers except caddy)

The only prerequisite for this command is docker.

### Run all containers:
```
./spin_up.sh dev hard
```

Navigate to localhost:1443 and voila!
