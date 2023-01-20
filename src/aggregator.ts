import { Datastore, Key } from "@google-cloud/datastore";

import { DistributedCounter, keyToString, runInTransaction } from "./shared";

type Dependencies = {
  datastore: Datastore;
};
type ExcludeFromIndexes = { [K in string]?: string[] };

const defaultDependencies = (): Dependencies => ({
  datastore: new Datastore(),
});
export const isExcludeFromIndexes = (excludeFromIndexes: any): excludeFromIndexes is ExcludeFromIndexes => {
  if (typeof excludeFromIndexes !== "object") return false;
  for (const [key, values] of Object.entries(excludeFromIndexes)) {
    if (typeof key !== "string") return false;
    if (!Array.isArray(values)) return false;
    for (const value of values) {
      if (typeof value !== "string") return false;
    }
  }

  return true;
};

export const createAggregator = (
  distributedCounterKind = "distributed_counter",
  excludeFromIndexes: ExcludeFromIndexes = {},
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
    let isIgnoreIfNoEntity = false;

    for (const { properties, initial: tmpInitial, isIgnoreIfNoEntity: tmpIsIgnoreIfNoEntity } of distributedCounters) {
      initial ??= tmpInitial;
      if (tmpIsIgnoreIfNoEntity) isIgnoreIfNoEntity = true;
      for (const [key, value] of Object.entries(properties)) {
        aggregated.set(key, (aggregated.get(key) ?? 0) + value);
      }
    }

    if (aggregated.size === 0) return;

    await runInTransaction(async (transaction) => {
      const [entity]: [Nullable<any>] = await transaction.get(key);
      if (entity == undefined && isIgnoreIfNoEntity) return;

      const updatedEntity = entity ?? initial ?? {};
      let hasChange = false;
      for (const [key, value] of aggregated) {
        if (updatedEntity[key] === value) continue;
        hasChange = true;
        updatedEntity[key] = value;
      }

      if (hasChange) transaction.upsert({ key, data: updatedEntity, excludeFromIndexes: excludeFromIndexes[key.kind] ?? [] });
    }, datastore);
  };
};
