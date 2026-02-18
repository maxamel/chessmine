# first arg must be prod/dev/debug-gs/debug-caddy
# second arg must be soft/hard
valid_envs="prod dev debug-gs debug-caddy"
if [[ " $valid_envs " =~ $1 ]]; then
    echo "Deploying $1 Env"
else
    echo "$1 is not a valid env. Exiting"
    exit 1
fi

valid_deployments="soft hard"
if [[ " $valid_deployments " =~ $2 ]]; then
    echo "This will be a $2 deployment"
else
    echo "$2 is not a valid deployment. Exiting"
    exit 1
fi

bash build_prometheus_targets.sh $1

if [ "$1" == "prod" ]; then
    docker compose -f docker-compose-$1.yml pull
    if [ "$2" == "soft" ]; then
      ./soft_deploy.sh $1
    else
      docker volume prune -f
      docker compose -f docker-compose-$1.yml up -d --no-deps --remove-orphans
    fi
else
    if [ "$2" == "soft" ]; then
      ./soft_deploy.sh $1
    else
      docker compose -f docker-compose-$1.yml down
      docker compose -f docker-compose-$1.yml up -d --build --force-recreate --remove-orphans
    fi
fi
