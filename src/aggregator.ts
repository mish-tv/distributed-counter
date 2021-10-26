import { Datastore, Key } from "@google-cloud/datastore";

import { DistributedCounter, runInTransaction } from "./shared";

type Dependencies = {
  datastore: Datastore;
};

const defaultDependencies = (): Dependencies => ({
  datastore: new Datastore(),
});

export const createAggregator = (
  distributedKind = "__distributed_counter_distributed__",
  dependencies: Dependencies = defaultDependencies(),
) => {
  const { datastore } = dependencies;

  return async (key: Key) => {
    const [distributedCounters]: [Pick<DistributedCounter, "properties">[], any] = await datastore
      .createQuery(distributedKind)
      .filter("key", key)
      .select("properties")
      .run();

    const aggregated = new Map<string, number>();

    for (const { properties } of distributedCounters) {
      for (const [key, value] of Object.entries(properties)) {
        aggregated.set(key, (aggregated.get(key) ?? 0) + value);
      }
    }

    await runInTransaction(async (transaction) => {
      const [entity]: [Nullable<Record<string, number>>] = await transaction.get(key);
      const updatedEntity = entity ?? {};
      for (const [key, value] of aggregated) {
        updatedEntity[key] = value;
      }
      transaction.upsert({ key, data: updatedEntity });
    }, datastore);
  };
};
