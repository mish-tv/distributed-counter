import { Key } from "@google-cloud/datastore";

import { createAggregator, isExcludeFromIndexes } from "./aggregator";
import { createMocks } from "./tests";

describe("aggregate", () => {
  let key: Key;

  let mocks: ReturnType<typeof createMocks>;
  let aggregate: ReturnType<typeof createAggregator>;

  beforeEach(() => {
    mocks = createMocks();
    key = mocks.datastore.key({ path: ["Counter", "dummy-id"] });
    aggregate = createAggregator("Distributed", {}, mocks);

    mocks.datastoreMock.transactionMock.get.mockResolvedValue([undefined]);
    mocks.datastoreMock.queryMock.run.mockReturnValue([
      [
        { properties: { x: 1 } },
        { properties: { y: 2 } },
        { properties: { z: 4 } },
        { properties: { x: 8, y: 16 } },
      ],
    ]);
  });

  it("aggregates the distributed counters and stores in the actual entity.", async () => {
    await aggregate(key);

    expect(mocks.datastoreMock.createQuery).toBeCalledWith("Distributed");
    expect(mocks.datastoreMock.queryMock.filter).toBeCalledWith(
      "key",
      "Counter.dummy-id"
    );
    expect(mocks.datastoreMock.transactionMock.get).toBeCalledWith(key);
    expect(mocks.datastoreMock.transactionMock.upsert).toBeCalledWith({
      key,
      data: { x: 9, y: 18, z: 4 },
      excludeFromIndexes: [],
    });
  });

  context("If the actual entity already exists", () => {
    beforeEach(() => {
      mocks.datastoreMock.transactionMock.get.mockResolvedValue([
        { foo: "bar", x: 10000 },
      ]);
    });

    it("reflects the value in the actual entity.", async () => {
      await aggregate(key);

      expect(mocks.datastoreMock.transactionMock.upsert).toBeCalledWith({
        key,
        data: { foo: "bar", x: 9, y: 18, z: 4 },
        excludeFromIndexes: [],
      });
    });
  });

  context("If the distributed counter does not exist", () => {
    beforeEach(() => {
      mocks.datastoreMock.queryMock.run.mockReturnValue([[]]);
    });

    it("doesn't do anything.", async () => {
      await aggregate(key);

      expect(mocks.datastoreMock.transactionMock.get).not.toBeCalled();
      expect(mocks.datastoreMock.transactionMock.upsert).not.toBeCalled();
      expect(mocks.datastoreMock.transactionMock.commit).not.toBeCalled();
    });
  });

  context("If no changes were made to the properties", () => {
    beforeEach(() => {
      mocks.datastoreMock.transactionMock.get.mockResolvedValue([
        { foo: "bar", x: 9, y: 18, z: 4 },
      ]);
    });

    it("does not do upsert", async () => {
      await aggregate(key);

      expect(mocks.datastoreMock.transactionMock.get).toBeCalledWith(key);
      expect(mocks.datastoreMock.transactionMock.upsert).not.toBeCalled();
    });
  });

  context("If an initial exists", () => {
    beforeEach(() => {
      mocks.datastoreMock.queryMock.run.mockReturnValue([
        [
          { properties: { x: 1 }, initial: { x: 2, foo: "bar" } },
          { properties: { y: 2 }, initial: { bar: "baz" } },
          { properties: { z: 4 } },
          { properties: { x: 8, y: 16 } },
        ],
      ]);
    });

    it("uses initial as the initial entity, and ignores the value to be aggregated, even if it is set to the initial.", async () => {
      await aggregate(key);

      expect(mocks.datastoreMock.transactionMock.upsert).toBeCalledWith({
        key,
        data: { foo: "bar", x: 9, y: 18, z: 4 },
        excludeFromIndexes: [],
      });
    });

    context("If the actual entity already exists", () => {
      beforeEach(() => {
        mocks.datastoreMock.transactionMock.get.mockResolvedValue([
          { bar: "baz", x: 10000 },
        ]);
      });

      it("doesn't use the initial.", async () => {
        await aggregate(key);

        expect(mocks.datastoreMock.transactionMock.upsert).toBeCalledWith({
          key,
          data: { bar: "baz", x: 9, y: 18, z: 4 },
          excludeFromIndexes: [],
        });
      });
    });
  });

  context("If ignore is true", () => {
    beforeEach(() => {
      mocks.datastoreMock.queryMock.run.mockReturnValue([
        [
          { properties: { x: 1 }, initial: { x: 2, foo: "bar" } },
          { properties: { y: 2 }, initial: { bar: "baz" } },
          { properties: { z: 4 }, isIgnoreIfNoEntity: true },
          { properties: { x: 8, y: 16 } },
        ],
      ]);
    });

    it("Ignore if entity does not exist.", async () => {
      await aggregate(key);

      expect(mocks.datastoreMock.transactionMock.upsert).not.toBeCalled();
    });

    context("If the actual entity already exists", () => {
      beforeEach(() => {
        mocks.datastoreMock.transactionMock.get.mockResolvedValue([
          { bar: "baz", x: 10000 },
        ]);
      });

      it("update the entity.", async () => {
        await aggregate(key);

        expect(mocks.datastoreMock.transactionMock.upsert).toBeCalledWith({
          key,
          data: { bar: "baz", x: 9, y: 18, z: 4 },
          excludeFromIndexes: [],
        });
      });
    });
  });

  context("If a value is specified for excludeFromIndexes", () => {
    beforeEach(() => {
      aggregate = createAggregator(
        "Distributed",
        { baz: ["a"], [key.kind]: ["foo", "bar"] },
        mocks
      );
    });

    it("reflects it in the subject kind.", async () => {
      await aggregate(key);

      expect(mocks.datastoreMock.transactionMock.upsert).toBeCalledWith({
        key,
        data: { x: 9, y: 18, z: 4 },
        excludeFromIndexes: ["foo", "bar"],
      });
    });
  });
});

describe("isExcludeFromIndexes", () => {
  it("checks if the type is ExcludeFromIndexes.", () => {
    expect(isExcludeFromIndexes({})).toBeTruthy();
    expect(isExcludeFromIndexes({ a: ["a", "b"], c: ["d"] })).toBeTruthy();
    expect(isExcludeFromIndexes({ a: ["a", "b", 1], c: ["d"] })).toBeFalsy();
    expect(isExcludeFromIndexes({ a: ["a", "b"], 1: ["d"] })).toBeTruthy();
    expect(isExcludeFromIndexes({ a: ["a", "b"], c: "d" })).toBeFalsy();
    expect(isExcludeFromIndexes("a")).toBeFalsy();
    expect(isExcludeFromIndexes(undefined)).toBeFalsy();
    expect(isExcludeFromIndexes(null)).toBeFalsy();
    expect(isExcludeFromIndexes([])).toBeFalsy();
  });
});
