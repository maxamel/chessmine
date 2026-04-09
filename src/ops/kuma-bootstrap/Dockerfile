FROM python:3.10-alpine
WORKDIR /usr/app/
COPY requirements.txt .
COPY bootstrap.py .

RUN apk add acl
RUN pip install --no-cache-dir -r requirements.txt


RUN adduser -D game
RUN setfacl -Rdm u:game:rwx /usr/app/
RUN setfacl -Rdm u:game:rwx /var/log/
RUN chown -hR game /usr/app/ && chown -hR game /var/log/
USER game
HEALTHCHECK CMD ps -p 1 | grep python || exit 1

CMD ["python", "bootstrap.py"]
