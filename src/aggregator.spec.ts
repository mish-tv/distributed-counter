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

    expect(mocks.datastoreMock.transactionMock.upsert).toBeCalledWith({ key, data: { x: 9, y: 18, z: 4 } });
  });
});
