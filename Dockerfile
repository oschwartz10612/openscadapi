FROM debian:latest

RUN apt-get update
RUN apt-get install -y --no-install-recommends openscad curl
RUN apt-get install -y xvfb
RUN apt-get install -y nodejs npm
RUN npm install npm@latest -g

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci --only=production

RUN mkdir png
RUN mkdir stl
RUN mkdir scad

COPY . .

RUN mv -v ./kredit/* /usr/share/fonts/
RUN fc-cache -f -v
RUN fc-list | grep "kredit"

EXPOSE 8080
CMD [ "node", "index.js" ]

