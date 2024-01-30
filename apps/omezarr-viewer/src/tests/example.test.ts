import { yay } from "../example";

describe("what", () => {
  it("hey", () => {
    const result = yay(3);
    expect(result).toEqual([6, 6]);
  });
});
