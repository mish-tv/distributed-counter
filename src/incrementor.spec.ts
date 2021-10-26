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
      1000,
      10_000,
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
          body: Buffer.from('{"key":{"path":["Counter","dummy-id"]}}'),
          httpMethod: "POST",
          url: "http://aggregate.example.com",
        },
        name: expect.stringMatching(
          /^projects\/dummy-project-id\/locations\/us-east4\/queues\/distributed-counter-Counter\/tasks\/[0-9a-f-]{36}$/,
        ),
        scheduleTime: { seconds: now / 1000 + 10 },
      },
    });
  });

  it("works properly when keys containing namespace and id are specified.", async () => {
    const key = mocks.datastore.key({ path: ["Counter", 123], namespace: "dummy-namespace" });
    await increment(key, "dummyValue", 2);

    expect(mocks.datastoreMock.transactionMock.get).toBeCalledWith(
      expect.objectContaining({
        name: expect.stringMatching(/^dummy-namespace\.Counter\.123\.[0-9a-f]{8}$/),
      }),
    );
    expect(mocks.datastoreMock.transactionMock.get).toBeCalledWith(
      expect.objectContaining({ name: "dummy-namespace.Counter.123" }),
    );
    expect(mocks.datastoreMock.transactionMock.upsert).toBeCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          key: expect.objectContaining({ kind: "Counter", id: 123, namespace: "dummy-namespace" }),
        }),
        key: expect.objectContaining({
          name: expect.stringMatching(/^dummy-namespace\.Counter\.123\.[0-9a-f]{8}$/),
        }),
      }),
    );
    expect(mocks.datastoreMock.transactionMock.upsert).toBeCalledWith(
      expect.objectContaining({ key: expect.objectContaining({ kind: "Meta", name: "dummy-namespace.Counter.123" }) }),
    );
    expect(mocks.tasksMock.createTask).toBeCalledWith(
      expect.objectContaining({
        task: expect.objectContaining({
          httpRequest: expect.objectContaining({
            body: Buffer.from(
              '{"key":{"namespace":"dummy-namespace","path":["Counter",{"type":"DatastoreInt","value":"123"}]}}',
            ),
          }),
        }),
      }),
    );
  });

  context("If a distributed counter already exists", () => {
    beforeEach(() => {
      mocks.datastoreMock.transactionMock.get.mockImplementation((key) =>
        key.kind === "Distributed" ? [{ properties: { dummyValue: 101, dummy2: "foo" } }] : [undefined],
      );
    });

    it("increments and stores the value of the counter that existed.", async () => {
      const key = mocks.datastore.key({ path: ["Counter", "dummy-id"] });
      await increment(key, "dummyValue");

      expect(mocks.datastoreMock.transactionMock.upsert).toBeCalledWith({
        data: {
          properties: { dummyValue: 102, dummy2: "foo" },
        },
        excludeFromIndexes: ["properties"],
        key: expect.objectContaining({
          kind: "Distributed",
          name: expect.stringMatching(/^Counter\.dummy-id\.[0-9a-f]{8}$/),
        }),
      });
    });
  });

  context("If a distributed counter already exists, but the property does not exist", () => {
    beforeEach(() => {
      mocks.datastoreMock.transactionMock.get.mockImplementation((key) =>
        key.kind === "Distributed" ? [{ properties: { dummy2: "foo" } }] : [undefined],
      );
    });

    it("adds properties to the distributed counter and stores it.", async () => {
      const key = mocks.datastore.key({ path: ["Counter", "dummy-id"] });
      await increment(key, "dummyValue", 3);

      expect(mocks.datastoreMock.transactionMock.upsert).toBeCalledWith({
        data: {
          properties: { dummyValue: 3, dummy2: "foo" },
        },
        excludeFromIndexes: ["properties"],
        key: expect.objectContaining({
          kind: "Distributed",
          name: expect.stringMatching(/^Counter\.dummy-id\.[0-9a-f]{8}$/),
        }),
      });
    });
  });

  context("If the aggregate has already been reserved", () => {
    beforeEach(() => {
      mocks.datastoreMock.transactionMock.get.mockImplementation((key) =>
        key.kind === "Meta" ? [{ scheduleTime: now + 5000 }] : [undefined],
      );
    });

    it("updates the value of the distributed counter, but does not reserve aggregate.", async () => {
      const key = mocks.datastore.key({ path: ["Counter", "dummy-id"] });
      await increment(key, "dummyValue", 2);

      expect(mocks.datastoreMock.transactionMock.upsert).toBeCalledTimes(1);
      expect(mocks.datastoreMock.transactionMock.upsert).toBeCalledWith(
        expect.objectContaining({
          key: expect.objectContaining({
            kind: "Distributed",
            name: expect.stringMatching(/^Counter\.dummy-id\.[0-9a-f]{8}$/),
          }),
        }),
      );
      expect(mocks.tasksMock.createTask).not.toBeCalled();
    });
  });

  context("If the aggregate is reserved but will be executed soon", () => {
    beforeEach(() => {
      mocks.datastoreMock.transactionMock.get.mockImplementation((key) =>
        key.kind === "Meta" ? [{ scheduleTime: now + 4999 }] : [undefined],
      );
    });

    it("makes an reservation for the aggregate.", async () => {
      const key = mocks.datastore.key({ path: ["Counter", "dummy-id"] });
      await increment(key, "dummyValue", 2);

      expect(mocks.datastoreMock.transactionMock.upsert).toBeCalledTimes(2);
      expect(mocks.tasksMock.createTask).toBeCalled();
    });
  });
});
