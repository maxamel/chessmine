docker login https://ewr.vultrcr.com/chessmine -u $registry_username -p $registry_password
#retag images
docker rmi ewr.vultrcr.com/chessmine/game_server:prev
docker pull ewr.vultrcr.com/chessmine/game_server:prev
docker tag ewr.vultrcr.com/chessmine/game_server:prev ewr.vultrcr.com/chessmine/game_server:curr
docker push ewr.vultrcr.com/chessmine/game_server:curr

docker rmi ewr.vultrcr.com/chessmine/frontend:prev
docker pull ewr.vultrcr.com/chessmine/frontend:prev
docker tag ewr.vultrcr.com/chessmine/frontend:prev ewr.vultrcr.com/chessmine/frontend:curr
docker push ewr.vultrcr.com/chessmine/frontend:curr

docker rmi ewr.vultrcr.com/chessmine/operator:prev
docker pull ewr.vultrcr.com/chessmine/operator:prev
docker tag ewr.vultrcr.com/chessmine/operator:prev ewr.vultrcr.com/chessmine/operator:curr
docker push ewr.vultrcr.com/chessmine/operator:curr
