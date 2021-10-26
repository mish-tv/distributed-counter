import { createHashKeys } from "./shared";

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
