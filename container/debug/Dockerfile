FROM node:14.17.5-bullseye-slim
WORKDIR /app

RUN apt-get update
RUN apt-get install -y git

RUN npm install mish-tv/nodejs-datastore#tmp/build @google-cloud/tasks @mish-tv/stackdriver-logger
COPY lib/cjs/ cjs/

CMD ["node", "./cjs/aggregate-server.js"]
