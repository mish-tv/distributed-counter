import { Key } from "@google-cloud/datastore";

import { createIncrementor } from "./incrementor";
import { createMocks } from "./tests";

describe("increment", () => {
  const url = "http://aggregate.example.com";
  const projectId = "dummy-project-id";
  const location = "us-east4";

  let mocks: ReturnType<typeof createMocks>;
  let increment: ReturnType<typeof createIncrementor>;

  beforeEach(() => {
    mocks = createMocks();
    increment = createIncrementor(
      url,
      (key, client) => client.queuePath(projectId, location, `distributed-counter-${key.kind}`),
      (key) => (key.kind === "Counter" ? 1000 : 100),
      (key) => (key.kind === "Counter" ? 10_000 : 60_000),
      "Distributed",
      "Meta",
      mocks,
    );

    mocks.datastoreMock.transactionMock.get.mockResolvedValue([undefined]);
  });

  it("is dummy", async () => {
    const key = mocks.datastore.key({ path: ["Counter", "dummy-id"] });
    await increment(key, "value", 2);

    expect(mocks.datastoreMock.transactionMock.get).toBeCalledWith(
      expect.objectContaining({ kind: "Distributed", name: expect.stringMatching(/^Counter\.dummy-id\.[a-zA-Z0-9]{6}$/) }),
    );
    expect(mocks.datastoreMock.transactionMock.get).toBeCalledWith(
      expect.objectContaining({ kind: "Meta", name: "Counter.dummy-id" }),
    );
    expect(mocks.datastoreMock.transactionMock.upsert).toBeCalledWith({
      data: {
        key: {
          kind: "Counter",
          name: "dummy-id",
          namespace: undefined,
          path: ["Counter", "dummy-id"],
        },
        properties: {
          value: NaN,
        },
      },
      excludeFromIndexes: ["properties"],
      key: {
        kind: "Distributed",
        name: "Counter.dummy-id.s6RGMw",
        namespace: undefined,
        path: ["Distributed", "Counter.dummy-id.s6RGMw"],
      },
    });
  });
});
