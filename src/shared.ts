import { Datastore, Key, Transaction } from "@google-cloud/datastore";
import { createHash } from "crypto";

const retry = 5;
type ConflictError = { code: 10 };
const isConflictError = (error: any): error is ConflictError => error.code === 10;
export const runInTransaction = async <T>(handler: (transaction: Transaction) => Promisable<T>, datastore: Datastore) => {
  let err: any;

  for (let i = 0; i < retry; i++) {
    const transaction = datastore.transaction();

    const result = await (async () => {
      try {
        await transaction.run();

        return await handler(transaction);
      } catch (e) {
        await transaction.rollback();
        throw e;
      }
    })();

    try {
      await transaction.commit();
    } catch (e) {
      if (isConflictError(e)) {
        err = e;
        continue;
      }
      throw e;
    }

    return result;
  }

  throw err;
};

export type DistributedCounter = { properties: Record<string, number>; defaultEntity?: any; key: string };

export const createHashKeys = () => {
  const result: string[] = [];
  for (let i = 0; i < 1000; i++) {
    const data = new Uint32Array([i]);
    result.push(createHash("sha1").update(data).digest("hex").slice(0, 8));
  }

  return result;
};

export const hashKeys = createHashKeys();

export const keyToString = (key: Key) => {
  const serialized = key.serialized;

  return [
    ...(serialized.namespace == undefined ? [] : [serialized.namespace]),
    ...serialized.path.map((n) => (typeof n === "string" ? n : n.toString())),
  ].join(".");
};
