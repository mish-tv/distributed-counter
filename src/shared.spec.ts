import { createMocks } from "./tests";
import { createHashKeys, runInTransaction } from "./shared";

describe("createHashKeys", () => {
  it("returns a fixed string of 1000 characters.", async () => {
    const hashKeys = createHashKeys();
    expect(new Set(hashKeys).size).toBe(1000);
    expect(hashKeys.length).toBe(1000);
    for (const hashKey of hashKeys) {
      expect(hashKey).toStrictEqual(expect.stringMatching(/^[0-9a-f]{8}$/));
    }

    expect(createHashKeys()).toStrictEqual(hashKeys);
  });
});

describe("runInTransaction", () => {
  it("will commit if the handler exits successfully.", async () => {
    const mocks = createMocks();
    expect(await runInTransaction(() => 1, mocks.datastore)).toBe(1);
    expect(mocks.datastoreMock.transactionMock.run).toBeCalledTimes(1);
    expect(mocks.datastoreMock.transactionMock.commit).toBeCalledTimes(1);
    expect(mocks.datastoreMock.transactionMock.rollback).not.toBeCalled();
  });

  it("will roll back and throw an exception if the handler throws an exception.", async () => {
    const mocks = createMocks();
    await expect(() =>
      runInTransaction(() => {
        throw new Error("dummy");
      }, mocks.datastore),
    ).rejects.toThrow("dummy");
    expect(mocks.datastoreMock.transactionMock.run).toBeCalledTimes(1);
    expect(mocks.datastoreMock.transactionMock.rollback).toBeCalledTimes(1);
    expect(mocks.datastoreMock.transactionMock.commit).not.toBeCalled();
  });
});
