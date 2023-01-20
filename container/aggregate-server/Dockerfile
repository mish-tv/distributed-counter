FROM node:18.13.0-bullseye-slim
RUN apt-get update
RUN apt-get install -y git
RUN npm install -g @mish-tv/distributed-counter@1.0.0 https://github.com/mish-tv/nodejs-datastore.git#tmp/build @google-cloud/tasks

CMD ["aggregate-server"]
