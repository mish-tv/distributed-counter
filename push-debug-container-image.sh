set -eu

npm run build

TAG="debug"

gcloud config configurations activate mish-tv

mv .gitignore _gitignore
gcloud builds submit --substitutions=_TAG=${TAG} --config=./container/debug/cloudbuild.yaml .
mv _gitignore .gitignore
