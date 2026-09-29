import { describe, expect, it } from "vitest";
import { mergeDays } from "./store";
import { HOUR } from "./time";
import { modelRainLevelAt, seriesValueAt } from "./values";

const geo = { bbox: [0, 0, 1, 1] as const, nx: 2, ny: 2 };
const t0 = Date.parse("2026-09-30T14:00:00+07:00");
const iso = (t: number) => new Date(t).toISOString();
// Four grid corners per hour; the centre of the cell is their average.
const series = mergeDays([{
  hours: [iso(t0), iso(t0 + HOUR)],
  temp: [[30, 30, 30, 30], [34, 34, 34, 34]],
  precip: [[0, 0, 0, 0], [6, 6, 6, 6]],
  prob: [[10, 10, 10, 10], [80, 80, 80, 80]],
}], ["temp", "precip", "prob"]);

describe("values at a place and minute", () => {
  it("interpolates between hours and in space", () => {
    expect(seriesValueAt(series, "temp", t0, 0.5, 0.5, geo)).toBe(30);
    expect(seriesValueAt(series, "temp", t0 + 0.25 * HOUR, 0.5, 0.5, geo)).toBe(31);
    expect(seriesValueAt(series, "temp", t0 + HOUR, 0.5, 0.5, geo)).toBe(34);
  });

  it("returns null without data, outside the grid or far outside the series", () => {
    expect(seriesValueAt(null, "temp", t0, 0.5, 0.5, geo)).toBeNull();
    expect(seriesValueAt(series, "feels", t0, 0.5, 0.5, geo)).toBeNull();
    expect(seriesValueAt(series, "temp", t0, 2, 0.5, geo)).toBeNull();
    expect(seriesValueAt(series, "temp", t0 + 3 * HOUR, 0.5, 0.5, geo)).toBeNull();
  });

  it("classifies model rain with the layer's probability and amount thresholds", () => {
    expect(modelRainLevelAt(series, t0, 0.5, 0.5, geo)).toBe(0);
    expect(modelRainLevelAt(series, t0 + HOUR, 0.5, 0.5, geo)).toBe(3);
    expect(modelRainLevelAt(null, t0, 0.5, 0.5, geo)).toBeNull();
  });
});
