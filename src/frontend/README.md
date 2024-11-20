### Run caddy container from master

Caddy runs an official image with a set version. If you want to run caddy from latest master follow the below steps.

Build caddy image with dockerfile that builds from source:
```
docker build -f DockerfileCaddyMaster -t caddy_master --build-arg APP_URL=http://localhost --build-arg BE_URL=host.docker.internal .
```
Next run the docker compose which spins all containers but caddy:
```
docker compose -f docker-compose-debug-caddy.yml up -d --build --force-recreate
```
Finally run the image we built for caddy and expose port 80:
```
docker run -p 80:80 -it caddy_master caddy/cmd/caddy/caddy run --config Caddyfile
```

Navigate to localhost/ to reach the site.