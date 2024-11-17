FROM woahbase/alpine-lua

WORKDIR /usr/app/

COPY . .

RUN apk add acl curl-dev gcc musl-dev make m4 libffi-dev openssl-dev bsd-compat-headers
RUN luarocks install milua && luarocks install redis-lua && luarocks install lunajson && luarocks install Lua-cURL

#RUN adduser -D operator
#RUN setfacl -Rdm u:operator:rwx /usr/app/
#RUN setfacl -Rdm u:operator:rwx /var/log/
#RUN chown -hR operator /usr/app/ && chown -hR operator /var/log/
#USER operator
HEALTHCHECK CMD curl --fail http://localhost:8800/healthcheck || exit 1

CMD [ "lua", "./src/app.lua" ]
