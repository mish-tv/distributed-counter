FROM node:14.17.5-bullseye-slim
RUN apt-get update
RUN apt-get install -y git
RUN npm install -g @mish-tv/distributed-counter@0.0.7 mish-tv/nodejs-datastore#tmp/build @google-cloud/tasks

CMD ["aggregate-server"]
