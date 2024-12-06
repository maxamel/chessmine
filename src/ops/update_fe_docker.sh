target=""

echo PROCESSING $1
A="$(echo $1 | cut -d'/' -f1)"
B="$(echo $1 | cut -d'/' -f2)"

if [ $A = "static" ]; then
target=$B
else
target=$A/$B
fi
echo COPYING $target INTO caddy:/var/www/html/static/$target
cp $target ${target}temp
if [[ $OSTYPE == 'darwin'* ]]; then
  gsed -i "s#APP_URL#localhost:1443#g" ${target}temp
else
  sed -i "s#APP_URL#localhost:1443#g" ${target}temp
fi
docker cp ./${target}temp caddy:/var/www/html/static/$target
status=$?
if [ $status = 0 ]; then
echo COPIED
rm -rf ${target}temp
else
echo COPY FAILED
rm -rf ${target}temp
fi
