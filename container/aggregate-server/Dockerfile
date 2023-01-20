FROM node:18.13.0-bullseye-slim
RUN apt-get update
RUN apt-get install -y git
RUN npm install -g @mish-tv/distributed-counter@1.0.0 @google-cloud/datastore@7.1.0 @google-cloud/tasks@3.0.5

CMD ["aggregate-server"]
