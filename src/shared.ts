import { Datastore, Key, Transaction } from "@google-cloud/datastore";
import { createHash } from "crypto";

export const runInTransaction = async <T>(handler: (transaction: Transaction) => Promisable<T>, datastore: Datastore) => {
  const transaction = datastore.transaction();
  try {
    await transaction.run();
    const result = await handler(transaction);
    await transaction.commit();

    return result;
  } catch (e) {
    await transaction.rollback();
    throw e;
  }
};

export type DistributedCounter = { properties: Record<string, number>; key: Key };

export const createHashKeys = () => {
  const result: string[] = [];
  for (let i = 0; i < 1000; i++) {
    const data = new Uint32Array([i]);
    result.push(createHash("sha1").update(data).digest("hex").slice(0, 8));
  }

  return result;
};

export const hashKeys = createHashKeys();
