import { createIncrementor } from "./incrementor";
import { createMocks } from "./tests";

describe("increment", () => {
  const url = "http://aggregate.example.com";
  const projectId = "dummy-project-id";
  const location = "us-east4";

  let mocks: ReturnType<typeof createMocks>;
  let increment: ReturnType<typeof createIncrementor>;

  const now = 1_000_000_000_000;

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

    jest.spyOn(Date, "now").mockReturnValue(now);
    mocks.datastoreMock.transactionMock.get.mockResolvedValue([undefined]);
  });

  it("increments the value to a distributed counter and reserves the aggregate.", async () => {
    const key = mocks.datastore.key({ path: ["Counter", "dummy-id"] });
    await increment(key, "dummyValue", 2);

    expect(mocks.datastoreMock.transactionMock.get).toBeCalledWith(
      expect.objectContaining({ kind: "Distributed", name: expect.stringMatching(/^Counter\.dummy-id\.[0-9a-f]{8}$/) }),
    );
    expect(mocks.datastoreMock.transactionMock.get).toBeCalledWith(
      expect.objectContaining({ kind: "Meta", name: "Counter.dummy-id" }),
    );
    expect(mocks.datastoreMock.transactionMock.upsert).toBeCalledWith({
      data: {
        key: expect.objectContaining({ kind: "Counter", name: "dummy-id" }),
        properties: { dummyValue: 2 },
      },
      excludeFromIndexes: ["properties"],
      key: expect.objectContaining({
        kind: "Distributed",
        name: expect.stringMatching(/^Counter\.dummy-id\.[0-9a-f]{8}$/),
      }),
    });
    expect(mocks.datastoreMock.transactionMock.upsert).toBeCalledWith({
      data: expect.objectContaining({ scheduleTime: now + 10_000 }),
      key: expect.objectContaining({ kind: "Meta", name: "Counter.dummy-id" }),
    });
    expect(mocks.tasksMock.createTask).toBeCalledWith({
      parent: "projects/dummy-project-id/locations/us-east4/queues/distributed-counter-Counter",
      task: {
        httpRequest: {
          body: '{"key":{"path":["Counter","dummy-id"]}}',
          httpMethod: "POST",
          url: "http://aggregate.example.com",
        },
        name: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/),
        scheduleTime: { seconds: now / 1000 + 10 },
      },
    });
  });
});
