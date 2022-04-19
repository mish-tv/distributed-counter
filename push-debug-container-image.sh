set -eu

TAG="debug"

gcloud config set project mish-tv

mv .gitignore _gitignore
gcloud builds submit --substitutions=_TAG=${TAG} --config=./container/debug/cloudbuild.yaml .
mv _gitignore .gitignore
