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
    const [distributedCounters]: [DistributedCounter[], any] = await datastore
      .createQuery(distributedCounterKind)
      .filter("key", keyText)
      .run();

    const aggregated = new Map<string, number>();
    let initial: Nullable<Record<string, any>> = undefined;

    for (const { properties, initial: tmpInitial } of distributedCounters) {
      initial ??= tmpInitial;
      for (const [key, value] of Object.entries(properties)) {
        aggregated.set(key, (aggregated.get(key) ?? 0) + value);
      }
    }

    if (aggregated.size === 0) return;

    await runInTransaction(async (transaction) => {
      const [entity]: [Nullable<any>] = await transaction.get(key);
      const updatedEntity = entity ?? initial ?? {};
      const excludeFromIndexes = updatedEntity[Datastore.EXCLUDE_FROM_INDEXES] ?? [];
      let hasChange = false;
      for (const [key, value] of aggregated) {
        if (updatedEntity[key] === value) continue;
        hasChange = true;
        updatedEntity[key] = value;
      }

      if (hasChange) transaction.upsert({ key, data: updatedEntity, excludeFromIndexes });
    }, datastore);
  };
};
