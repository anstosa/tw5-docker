FROM node:alpine

VOLUME /var/lib/wiki/data
WORKDIR /var/lib/wiki/server

COPY package.json .
RUN npm install --silent

COPY auth.js .
COPY style.css .
COPY login.ejs .
COPY quickStoreForm.ejs .
COPY quickStoreMessage.ejs .
EXPOSE 8080

COPY wiki.sh .

WORKDIR /var/lib/wiki/data
CMD /var/lib/wiki/server/wiki.sh
