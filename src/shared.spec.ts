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
  class ConflictError extends Error {
    code = 10;
    message = "dummy conflict error";
  }
  let mocks: ReturnType<typeof createMocks>;

  beforeEach(() => {
    mocks = createMocks();
  });

  it("will commit if the handler exits successfully.", async () => {
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

  context("If commit throws a conflicts error only once", () => {
    beforeEach(() => {
      mocks.datastoreMock.transactionMock.commit.mockRejectedValueOnce(new ConflictError());
    });

    it("recreates a transaction and re-execute the anonymous function.", async () => {
      let i = 0;
      await runInTransaction(() => {
        i += 1;
      }, mocks.datastore);
      expect(i).toBe(2);
      expect(mocks.datastoreMock.transaction).toBeCalledTimes(2);
      expect(mocks.datastoreMock.transactionMock.run).toBeCalledTimes(2);
      expect(mocks.datastoreMock.transactionMock.commit).toBeCalledTimes(2);
      expect(mocks.datastoreMock.transactionMock.rollback).not.toBeCalled();
    });
  });

  context("If commit always throws a conflict error", () => {
    beforeEach(() => {
      mocks.datastoreMock.transactionMock.commit.mockRejectedValue(new ConflictError());
    });

    it("throws an exception after re-running 5 times.", async () => {
      let i = 0;

      await expect(() =>
        runInTransaction(() => {
          i += 1;
        }, mocks.datastore),
      ).rejects.toThrow("dummy conflict error");
      expect(i).toBe(5);
      expect(mocks.datastoreMock.transaction).toBeCalledTimes(5);
      expect(mocks.datastoreMock.transactionMock.run).toBeCalledTimes(5);
      expect(mocks.datastoreMock.transactionMock.commit).toBeCalledTimes(5);
      expect(mocks.datastoreMock.transactionMock.rollback).not.toBeCalled();
    });
  });

  context("If commit throws a non-conflict error", () => {
    beforeEach(() => {
      mocks.datastoreMock.transactionMock.commit.mockRejectedValue(new Error("dummy error"));
    });

    it("will throw an exception soon.", async () => {
      let i = 0;

      await expect(() =>
        runInTransaction(() => {
          i += 1;
        }, mocks.datastore),
      ).rejects.toThrow("dummy error");
      expect(i).toBe(1);
      expect(mocks.datastoreMock.transaction).toBeCalledTimes(1);
      expect(mocks.datastoreMock.transactionMock.run).toBeCalledTimes(1);
      expect(mocks.datastoreMock.transactionMock.commit).toBeCalledTimes(1);
      expect(mocks.datastoreMock.transactionMock.rollback).not.toBeCalled();
    });
  });
});
