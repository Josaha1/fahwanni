import { describe, expect, it } from "vitest";
import { accumulateRain, accumulationRgba } from "./accumulation";

const start = Date.parse("2026-09-29T00:00:00Z");
const day = (from: number, count: number, rain = 2) => ({
  hours: Array.from({ length: count }, (_, i) => new Date(start + (from + i) * 3_600_000).toISOString()),
  precip: Array.from({ length: count }, () => [rain, 0]),
});

describe("accumulateRain", () => {
  it("sums the next 72 hours once across overlapping days", () => {
    expect(accumulateRain([day(0, 25), day(24, 49)], start)).toEqual({
      values: Float32Array.from([144, 0]), toMs: start + 72 * 3_600_000,
    });
  });

  it("requires at least 70 distinct hours in the window", () => {
    expect(accumulateRain([day(1, 69)], start)).toBeNull();
    expect(accumulateRain([day(1, 70)], start)?.values[0]).toBe(140);
    expect(accumulateRain([day(1, 72)], start + 30 * 60_000)?.values[0]).toBe(144);
  });

  it("rejects inconsistent grids", () => {
    const data = day(1, 72);
    data.precip[5] = [2];
    expect(accumulateRain([data], start)).toBeNull();
  });
});

describe("accumulationRgba", () => {
  it("uses the 90 and 150 mm cutoffs", () => {
    expect(accumulationRgba(89.9)).toBeNull();
    expect(accumulationRgba(90)).toEqual([249, 115, 22, 110]);
    expect(accumulationRgba(149.9)).toEqual([249, 115, 22, 110]);
    expect(accumulationRgba(150)).toEqual([185, 28, 28, 140]);
  });
});
