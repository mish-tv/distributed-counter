FROM node:14.17.5-bullseye-slim
WORKDIR /app

RUN apt-get update
RUN apt-get install -y git

RUN npm install -g https://github.com/mish-tv/nodejs-datastore.git#tmp/build @google-cloud/tasks @mish-tv/stackdriver-logger
COPY lib/cjs/ cjs/

CMD ["node", "./cjs/aggregate-server.js"]
