import { createAggregator } from "./aggregator";
import { createMocks } from "./tests";

describe("aggregate", () => {
  let mocks: ReturnType<typeof createMocks>;
  let aggregate: ReturnType<typeof createAggregator>;

  beforeEach(() => {
    mocks = createMocks();
    aggregate = createAggregator("Distributed", mocks);

    mocks.datastoreMock.transactionMock.get.mockResolvedValue([undefined]);
    mocks.datastoreMock.queryMock.run.mockReturnValue([
      [{ properties: { x: 1 } }, { properties: { y: 2 } }, { properties: { z: 4 } }, { properties: { x: 8, y: 16 } }],
    ]);
  });

  it("aggregates the distributed counters and stores in the actual entity.", async () => {
    const key = mocks.datastore.key({ path: ["Counter", "dummy-id"] });
    await aggregate(key);

    expect(mocks.datastoreMock.createQuery).toBeCalledWith("Distributed");
    expect(mocks.datastoreMock.queryMock.filter).toBeCalledWith("key", "Counter.dummy-id");
    expect(mocks.datastoreMock.transactionMock.get).toBeCalledWith(key);
    expect(mocks.datastoreMock.transactionMock.upsert).toBeCalledWith({ key, data: { x: 9, y: 18, z: 4 } });
  });

  context("If the actual entity already exists", () => {
    beforeEach(() => {
      mocks.datastoreMock.transactionMock.get.mockResolvedValue([{ foo: "bar", x: 10000 }]);
    });

    it("reflects the value in the actual entity.", async () => {
      const key = mocks.datastore.key({ path: ["Counter", "dummy-id"] });
      await aggregate(key);

      expect(mocks.datastoreMock.transactionMock.upsert).toBeCalledWith({ key, data: { foo: "bar", x: 9, y: 18, z: 4 } });
    });
  });

  context("If the distributed counter does not exist", () => {
    beforeEach(() => {
      mocks.datastoreMock.queryMock.run.mockReturnValue([[]]);
    });

    it("doesn't do anything.", async () => {
      const key = mocks.datastore.key({ path: ["Counter", "dummy-id"] });
      await aggregate(key);

      expect(mocks.datastoreMock.transactionMock.get).not.toBeCalled();
      expect(mocks.datastoreMock.transactionMock.upsert).not.toBeCalled();
      expect(mocks.datastoreMock.transactionMock.commit).not.toBeCalled();
    });
  });

  context("If no changes were made to the properties", () => {
    beforeEach(() => {
      mocks.datastoreMock.transactionMock.get.mockResolvedValue([{ foo: "bar", x: 9, y: 18, z: 4 }]);
    });

    it("does not do upsert", async () => {
      const key = mocks.datastore.key({ path: ["Counter", "dummy-id"] });
      await aggregate(key);

      expect(mocks.datastoreMock.transactionMock.get).toBeCalledWith(key);
      expect(mocks.datastoreMock.transactionMock.upsert).not.toBeCalled();
    });
  });
});
