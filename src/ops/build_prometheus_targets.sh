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

# read yaml file
eval $(parse_yaml docker-compose-$1.yml)
#echo $(parse_yaml docker-compose-dev.yml)
count=$services__game_server__deploy_replicas

targets="\"targets\":["
for i in $(seq 1 $count);
do
    targets=${targets}" \"chessmine-game_server-$i:2019\","
done
targets=$(sed 's/.\{1\}$/]/' <<< "$targets")
#echo $targets
if [[ $OSTYPE == 'darwin'* ]]; then
  gsed -i  "s/\"targets.*/$targets/g" targets.json
else
  sed -i  "s/\"targets.*/$targets/g" targets.json
fi

