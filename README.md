<h1 align="center">@mish-tv/distributed-counter</h1>

<div align="center">
<a href="https://www.npmjs.com/package/@mish-tv/distributed-counter"><img src="https://img.shields.io/npm/v/@mish-tv/distributed-counter.svg" alt="npm"></a>
<a href="https://github.com/mish-tv/distributed-counter/actions/workflows/build-and-test.yml"><img src="https://github.com/mish-tv/distributed-counter/actions/workflows/build-and-test.yml/badge.svg" alt="Build and test"></a>
<a href="https://codecov.io/gh/mish-tv/distributed-counter"><img src="https://img.shields.io/codecov/c/github/mish-tv/distributed-counter.svg" alt="coverage"></a>
<a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/github/license/mish-tv/distributed-counter.svg?style=flat" alt="license"></a>
</div>

<h4 align="center">`@mish-tv/distributed-counter is a library for creating distributed counters using CloudDatastore, CloudTasks, and CloudRun.</h4>

## Installation

```
npm install --save @mish-tv/distributed-counter
```

## Usage

### Preparation

- Enable Datastore / CloudRun / CloudTasks.
- Create a Queue with an arbitrary name in CloudTasks.
  In the following example, you will need a queue named distributed-counter-counter.
- Create a service account to run CloudRun from CloudTasks.
  Please refer to [this document](https://cloud.google.com/tasks/docs/creating-http-target-tasks#sa).

### Deploy aggregate server

Deploy a server application to CloudRun.
You can use the [image](https://hub.docker.com/repository/docker/malt03/aggregate-server) I have created.

The deployment to CloudRun is complete, note the URL to request.
Apply the URL you have note to the constant named url in the following sample code.

```sh
TAG=v1.2.0
REGION=${your_region}
IMAGE=us-east4-docker.pkg.dev/${YOUR_PROJECT_ID}/distributed-counter/aggregate-server:${TAG}

docker pull malt03/aggregate-server:${TAG}
docker tag malt03/aggregate-server:${TAG} ${IMAGE}
docker push ${IMAGE}

gcloud run deploy aggregate-distributed-counter --image ${IMAGE} --platform managed --region ${REGION} --no-allow-unauthenticated
```

### Implementation

```typescript
import { Datastore } from "@google-cloud/datastore";
import { createIncrementor } from "@mish-tv/distributed-counter";

const datastore = new Datastore();
const projectId = "";
const location = "us-east4";
// const url = `https://aggregate-distributed-counter-${dummy}-uk.a.run.app`;
// const serviceAccount = `cloud-tasks@${projectId}.iam.gserviceaccount.com`;
const increment = createIncrementor(url, serviceAccount, (key, client) =>
  client.queuePath(projectId, location, `distributed-counter-${key.kind}`)
);

export const incrementCounter = async (id: string, value: number) => {
  const key = datastore.key(["counter", id]);
  const initialEntity = { foo: "bar" };
  await increment(key, "value", value, {
    type: "INITIALIZE",
    properties: () => initialEntity,
  });
};
```
