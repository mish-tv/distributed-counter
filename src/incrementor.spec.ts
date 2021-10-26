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
  });
});
