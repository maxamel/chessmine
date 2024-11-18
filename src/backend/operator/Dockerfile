#checkov:skip=CKV_DOCKER_3: TODO figure out a way to add non-root user without breaking S6
FROM woahbase/alpine-lua:5.2.4

WORKDIR /home/alpine

COPY . .

RUN apk add acl curl-dev gcc musl-dev make m4 libffi-dev openssl-dev bsd-compat-headers
RUN luarocks install milua && luarocks install redis-lua && luarocks install lunajson && luarocks install Lua-cURL

#RUN addgroup --gid 3333 operators
#RUN adduser -D operator operators
#RUN setfacl -Rdm u:operator:rwx /usr/app/
#RUN setfacl -Rdm u:operator:rwx /etc/group
#RUN setfacl -Rdm u:operator:rwx /home/alpine
#RUN chown -hR alpine /run && chown -hR alpine /var/log/ && chown -hR alpine /home/alpine && chown -hR alpine /etc/group
#USER alpine
HEALTHCHECK CMD curl --fail http://localhost:8800/healthcheck || exit 1

CMD [ "lua", "./src/app.lua" ]
