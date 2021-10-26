import { randomUUID } from "crypto";
import { Datastore, Key } from "@google-cloud/datastore";
import { CloudTasksClient, protos as tasksProtos } from "@google-cloud/tasks";

import { DistributedCounter, hashKeys, runInTransaction } from "./shared";

const marginDuration = 5000;

type QueuePath = string | ((key: Key, client: CloudTasksClient) => string);
type DistributionNumber = number | ((key: Key) => number);
type Delay = number | ((key: Key) => number);
type Dependencies = {
  datastore: Datastore;
  tasks: CloudTasksClient;
};

type Meta = { scheduleTime: number };
type Task = tasksProtos.google.cloud.tasks.v2.ITask;

const keyToString = (key: Key) => {
  const serialized = key.serialized;

  return [
    ...(serialized.namespace == undefined ? [] : [serialized.namespace]),
    ...serialized.path.map((n) => (typeof n === "string" ? n : n.toString())),
  ].join(".");
};

const defaultDependencies = (): Dependencies => ({
  datastore: new Datastore(),
  tasks: new CloudTasksClient(),
});

const getDistributionKey = (distributionNumber: number) => hashKeys[Math.floor(Math.random() * distributionNumber)];

export const createIncrementor = (
  url: string,
  queuePath: QueuePath,
  distributionNumber: DistributionNumber = 1000,
  delay: Delay = 10_000,
  distributedCounterKind = "__distributed_counter_distributed__",
  metaKind = "__distributed_counter_meta__",
  dependencies: Dependencies = defaultDependencies(),
) => {
  const { datastore, tasks } = dependencies;
  const getQueuePath = typeof queuePath === "string" ? () => queuePath : queuePath;
  const getDistributionNumber = typeof distributionNumber === "number" ? () => distributionNumber : distributionNumber;
  const getDelay = typeof delay === "number" ? () => delay : delay;
  const wrapedGetDistributionKey = (key: Key) => getDistributionKey(getDistributionNumber(key));

  return async (key: Key, property: string, number = 1) => {
    const parent = getQueuePath(key, tasks);
    const scheduleTime = Date.now() + getDelay(key);
    const keyText = keyToString(key);
    const metaKey = datastore.key([metaKind, keyText]);

    const distributedCounterKey = datastore.key([distributedCounterKind, `${keyText}.${wrapedGetDistributionKey(key)}`]);

    await runInTransaction(async (transaction) => {
      const [[distributedCounter], [meta]]: [[Nullable<DistributedCounter>], [Nullable<Meta>]] = await Promise.all([
        transaction.get(distributedCounterKey),
        transaction.get(metaKey),
      ]);
      const updatedDistributedCounter = distributedCounter ?? { properties: {}, key };
      updatedDistributedCounter.properties[property] = (updatedDistributedCounter.properties[property] ?? 0) + number;

      const entity = { key: distributedCounterKey, data: updatedDistributedCounter, excludeFromIndexes: ["properties"] };
      transaction.upsert(entity);

      if (meta == undefined || meta.scheduleTime > scheduleTime - marginDuration) {
        const data: Meta = { scheduleTime };
        transaction.upsert({ key: metaKey, data });

        const task: Task = {
          name: randomUUID(),
          scheduleTime: { seconds: scheduleTime / 1000 },
          httpRequest: {
            httpMethod: "POST",
            url,
            body: JSON.stringify({ key: key.serialized }),
          },
        };
        await tasks.createTask({ parent, task });
      }
    }, datastore);
  };
};
