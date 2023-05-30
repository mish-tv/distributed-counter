FROM node:18.13.0-bullseye-slim
WORKDIR /app

RUN apt-get update
RUN apt-get install -y git

RUN npm install @google-cloud/datastore@7.5.1 @google-cloud/tasks@3.1.2 @mish-tv/stackdriver-logger
COPY lib/cjs/ cjs/

CMD ["node", "./cjs/aggregate-server.js"]
