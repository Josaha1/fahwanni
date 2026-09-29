import { describe, expect, it } from "vitest";
import { REFRESH, shouldRefresh } from "./refresh";

describe("map refresh decision", () => {
  it("uses five minutes for radar and one hour for slower data", () => {
    expect(REFRESH).toEqual({ radar: 300_000, slow: 3_600_000 });
  });

  it("fetches missing data and data at or beyond its maximum age", () => {
    expect(shouldRefresh(null, 0, REFRESH.radar)).toBe(true);
    expect(shouldRefresh(1_000, 300_999, REFRESH.radar)).toBe(false);
    expect(shouldRefresh(1_000, 301_000, REFRESH.radar)).toBe(true);
    expect(shouldRefresh(1_000, 3_601_000, REFRESH.slow)).toBe(true);
  });
});
