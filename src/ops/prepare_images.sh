docker compose -f docker-compose-prod.yml build --no-cache
docker login https://ewr.vultrcr.com/chessmine -u $registry_username -p $registry_password

# retag existing curr images to prev
docker rmi ewr.vultrcr.com/chessmine/game_server:curr
docker pull ewr.vultrcr.com/chessmine/game_server:curr
docker tag ewr.vultrcr.com/chessmine/game_server:curr ewr.vultrcr.com/chessmine/game_server:prev
docker push ewr.vultrcr.com/chessmine/game_server:prev

docker rmi ewr.vultrcr.com/chessmine/frontend:curr
docker pull ewr.vultrcr.com/chessmine/frontend:curr
docker tag ewr.vultrcr.com/chessmine/frontend:curr ewr.vultrcr.com/chessmine/frontend:prev
docker push ewr.vultrcr.com/chessmine/frontend:prev

# tag new images
docker tag game_server:curr ewr.vultrcr.com/chessmine/game_server:curr
docker tag frontend:curr ewr.vultrcr.com/chessmine/frontend:curr

# push new images
docker push ewr.vultrcr.com/chessmine/game_server:curr
docker push ewr.vultrcr.com/chessmine/frontend:curr