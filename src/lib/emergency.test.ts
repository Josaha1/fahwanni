import { describe, expect, it } from "vitest";
import { EMERGENCY_NUMBERS } from "./emergency";

describe("emergency numbers", () => {
  it("has four valid telephone links in the specified order", () => {
    expect(EMERGENCY_NUMBERS.map(({ number }) => number)).toEqual(["1784", "1460", "1669", "191"]);
    for (const { number, href } of EMERGENCY_NUMBERS) {
      expect(number).toMatch(/^\d{3,4}$/);
      expect(href).toBe(`tel:${number}`);
    }
  });
});
