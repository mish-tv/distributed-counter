import { Datastore } from "@google-cloud/datastore";
import { CloudTasksClient } from "@google-cloud/tasks";

export const createMocks = () => {
  const transactionMock = {
    run: jest.fn(),
    commit: jest.fn(),
    rollback: jest.fn(),
    get: jest.fn(),
    upsert: jest.fn(),
  };
  const datastoreMock = {
    transactionMock,
    key: jest.fn().mockImplementation((arg) => new Datastore().key(arg)),
    transaction: jest.fn().mockReturnValue(transactionMock),
  };
  const tasksMock = {
    queuePath: jest
      .fn()
      .mockImplementation((project, location, queue) => new CloudTasksClient().queuePath(project, location, queue)),
    createTask: jest.fn(),
  };

  return {
    datastoreMock,
    tasksMock,
    datastore: datastoreMock as unknown as Datastore,
    tasks: tasksMock as unknown as CloudTasksClient,
  };
};
