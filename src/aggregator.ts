import { Datastore, Key } from "@google-cloud/datastore";

import { DistributedCounter, keyToString, runInTransaction } from "./shared";

type Dependencies = {
  datastore: Datastore;
};

const defaultDependencies = (): Dependencies => ({
  datastore: new Datastore(),
});

export const createAggregator = (
  distributedCounterKind = "distributed_counter",
  dependencies: Dependencies = defaultDependencies(),
) => {
  const { datastore } = dependencies;

  return async (key: Key) => {
    const keyText = keyToString(key);
    const [distributedCounters]: [Pick<DistributedCounter, "properties">[], any] = await datastore
      .createQuery(distributedCounterKind)
      .filter("key", keyText)
      .run();

    const aggregated = new Map<string, number>();

    for (const { properties } of distributedCounters) {
      for (const [key, value] of Object.entries(properties)) {
        aggregated.set(key, (aggregated.get(key) ?? 0) + value);
      }
    }

    if (aggregated.size === 0) return;

    await runInTransaction(async (transaction) => {
      const [entity]: [Nullable<Record<string, number>>] = await transaction.get(key);
      const updatedEntity = entity ?? {};
      let hasChange = false;
      for (const [key, value] of aggregated) {
        if (updatedEntity[key] === value) continue;
        hasChange = true;
        updatedEntity[key] = value;
      }

      if (hasChange) transaction.upsert({ key, data: updatedEntity });
    }, datastore);
  };
};
