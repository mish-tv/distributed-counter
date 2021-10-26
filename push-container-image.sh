set -eu

TAG="v0.0.2"

gcloud config set project mish-tv

current=${PWD}
cd ./container/aggregate-server
gcloud builds submit --substitutions=_TAG=${TAG} .
cd ${current}

docker pull us-east4-docker.pkg.dev/mish-tv/distributed-counter/aggregate-server:${TAG}
docker tag us-east4-docker.pkg.dev/mish-tv/distributed-counter/aggregate-server:${TAG} malt03/aggregate-server:${TAG}
docker push malt03/aggregate-server:${TAG}
