FROM golang:1.23.2-alpine3.20

WORKDIR /var/www/html/
COPY . /var/www/html/

RUN apk add su-exec
RUN chmod u+s /sbin/su-exec
RUN cd /var/www/html/
RUN su-exec root go mod init example/html

USER user
HEALTHCHECK CMD curl --fail http://localhost || exit 1

CMD ["go run ."]