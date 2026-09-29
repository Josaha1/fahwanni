import { describe, expect, it } from "vitest";
import { buildClimatology, chooseSnap, percentile, windowContains } from "./climatology.mjs";

describe("river climatology", () => {
  it("interpolates percentiles without changing the input", () => {
    const values = [40, 10, 30, 20];
    expect(percentile(values, 0.5)).toBe(25);
    expect(percentile(values, 0.8)).toBe(34);
    expect(values).toEqual([40, 10, 30, 20]);
  });

  it("wraps the 15-day window at the year boundary", () => {
    expect(windowContains(366, 1)).toBe(true);
    expect(windowContains(351, 1)).toBe(false);
    expect(windowContains(16, 1)).toBe(true);
  });

  it("chooses the highest finite mean discharge cell", () => {
    expect(chooseSnap([
      { lat: 1, meanDischarge: NaN },
      { lat: 2, meanDischarge: 45 },
      { lat: 3, meanDischarge: 90 },
    ])).toMatchObject({ lat: 3 });
  });

  it("uses daily windows, annual maxima, and 2011 values", () => {
    const history = [
      { year: 2011, values: Array.from({ length: 365 }, (_, index) =>
        ({ doy: index + 1 + (index >= 59 ? 1 : 0), value: index === 199 ? 100 : 20 })) },
      { year: 2012, values: Array.from({ length: 366 }, (_, index) =>
        ({ doy: index + 1, value: index === 199 ? 200 : 30 })) },
    ];
    const result = buildClimatology(history);
    expect(result.doy[1]).toEqual({ p25: 20, p50: 25, p75: 30, p90: 30 });
    expect(result.annualMax).toEqual({ p50: 150, p80: 180 });
    expect(result.value2554[1]).toBe(20);
    expect(result.value2554[201]).toBe(100);
    expect(result.value2554[60]).toBeUndefined();
    expect(result.value2554[366]).toBe(20);
  });
});
