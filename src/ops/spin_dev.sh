#arg can be dev/debug-gs/debug-caddy
docker compose -f docker-compose-$1.yml down --rmi local
docker compose -f docker-compose-$1.yml up -d --build --force-recreate --remove-orphans