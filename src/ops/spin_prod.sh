docker compose -f docker-compose-prod.yml pull
bash build_prometheus_targets.sh prod
docker compose -f docker-compose-prod.yml up -d --no-deps --remove-orphans