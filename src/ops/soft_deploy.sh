#!/bin/bash
parse_yaml() {
   local prefix=$2
   local s='[[:space:]]*' w='[a-zA-Z0-9_]*' fs=$(echo @|tr @ '\034')
   sed -ne "s|^\($s\)\($w\)$s:$s\"\(.*\)\"$s\$|\1$fs\2$fs\3|p" \
        -e "s|^\($s\)\($w\)$s:$s\(.*\)$s\$|\1$fs\2$fs\3|p"  $1 |
   awk -F$fs '{
      indent = length($1)/2;
      vname[indent] = $2;
      for (i in vname) {if (i > indent) {delete vname[i]}}
      if (length($3) > 0) {
         vn=""; for (i=0; i<indent; i++) {vn=(vn)(vname[i])("_")}
         printf("%s%s%s=\"%s\"\n", "'$prefix'",vn, $2, $3);
      }
   }'
}

services="game_server operator"

for service in $services; do

  # redis and cadvisor are skipped in this installation
  containers=$(docker compose -f docker-compose-$1.yml ps -q $service)

  maximal_container_number=$(docker ps --filter "name=chessmine-$service" --format "{{.Names}}" | \
      awk -F'-' '{print $NF}' | \
      sort -n | \
      tail -n 1)

  replicas=$(docker compose -f docker-compose-$1.yml ps -q $service | wc -l)
  ((replicas++))
  echo "Scaling service $service to: $replicas"

  # Loop through each container and restart it one by one
  for container in $containers; do
    elapsed_time=0
    interval=8  # Check health once per 8 seconds

    container_name=$(docker inspect --format '{{.Name}}' $container)
    container_name="${container_name#/}"
    echo "Recreating $service container: $container_name"
    # Start the container again
    # Stop and remove the container


    # Start the container again
    docker compose -f docker-compose-$1.yml up -d --no-deps --no-recreate --scale $service=$replicas
    # Optional: Add a delay between recreations (e.g., 5 seconds)
    # Wait for the container to become healthy

    ((maximal_container_number++))
    new_container_name="${container_name%-*}-$maximal_container_number"
    echo "Waiting for container $new_container_name to become healthy..."
    new_container_id=$(docker ps -q -f "name=$new_container_name")
    # Check the health status of the container
    while [ "$elapsed_time" -le 48 ]; do
      # Get the current health status of the container
      health_status=$(docker inspect --format '{{.State.Health.Status}}' $new_container_id)
      echo "Container $new_container_name status: $health_status."

      # If the container is healthy, break out of the loop
      if [ "$health_status" == "healthy" ]; then
        echo "Container $new_container_name is healthy."
        echo "Stopping $container."
        docker stop $container
        echo "Removing $container."
        docker rm $container
        break
      fi

      # If the container is unhealthy or starting, keep checking until the timeout is reached
      if [ "$health_status" != "starting" ]; then
        echo "Container $new_container_name is not healthy yet. Current status: $health_status"
      fi

      # Increment elapsed time
      elapsed_time=$((elapsed_time + interval))

      # Wait for the specified interval before checking again
      sleep $interval
    done

    if [ "$health_status" != "healthy" ]; then
      echo "Container $new_container_name did not reach health in time. Status: $health_status. Aborting."
      break
    fi
  done
done

docker restart grafana
docker restart prometheus
# Start caddy thingy
eval $(parse_yaml docker-compose-$1.yml)
#echo $(parse_yaml docker-compose-dev.yml)
app_url=$services__caddy__build_args_APP_URL

echo PROCESSING caddy

echo COPYING ../frontend/static INTO caddy:/var/www/html/static/frontend/static
cp -r ../frontend/static ../frontend/statictemp
if [[ $OSTYPE == 'darwin'* ]]; then
  find ../frontend/statictemp/js/game.js -type f -exec gsed -i -e "s#APP_URL#$app_url#g" {} \;
  find ../frontend/statictemp/js/settings.js -type f -exec gsed -i -e "s#APP_URL#$app_url#g" {} \;
  find ../frontend/statictemp/js/header.js -type f -exec gsed -i -e "s#APP_URL#$app_url#g" {} \;
else
  find ../frontend/statictemp/js/game.js -type f -exec sed -i -e "s#APP_URL#$app_url#g" {} \;
  find ../frontend/statictemp/js/settings.js -type f -exec sed -i -e "s#APP_URL#$app_url#g" {} \;
  find ../frontend/statictemp/js/header.js -type f -exec sed -i -e "s#APP_URL#$app_url#g" {} \;
fi
docker cp ../frontend/statictemp/. caddy:/var/www/html/static
status=$?
if [ $status = 0 ]; then
echo COPIED
rm -r ../frontend/statictemp
else
echo COPY FAILED
rm -r ../frontend/statictemp
fi

# copy Caddyfile to its destination
docker cp ../frontend/Caddyfile caddy:/etc/caddy/Caddyfile
docker exec caddy caddy reload --config /etc/caddy/Caddyfile

status=$?
if [ $status = 0 ]; then
echo RELOAD COMPLETED
else
echo RELOAD FAILED
fi
