import { describe, expect, it } from "vitest";
import { HOUR } from "./time";
import { daysToLoad, localDayIndex, mergeDays, sampleSeries } from "./store";

const time = (day: number, hour = 0) => Date.parse(`2026-09-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:00:00+07:00`);
const iso = (day: number, hour = 0) => new Date(time(day, hour)).toISOString();

describe("forecast day store", () => {
  it("sorts hours, keeps the first duplicate, and stores each grid as Float32Array", () => {
    const series = mergeDays([
      { hours: [iso(29, 1), iso(29, 2)], u: [[1, 2], [3, 4]], v: [[5], [6]] },
      { hours: [iso(29, 0), iso(29, 1)], u: [[7, 8], [9, 10]], v: [[11], [12]] },
    ], ["u", "v"]);
    expect(series.times).toEqual([time(29), time(29, 1), time(29, 2)]);
    expect(series.grids.u.every((grid) => grid instanceof Float32Array)).toBe(true);
    expect(Array.from(series.grids.u[1])).toEqual([1, 2]);
    expect(Array.from(series.grids.v[0])).toEqual([11]);
  });

  it("samples hour brackets and rejects times more than an hour beyond the data", () => {
    const series = mergeDays([{ hours: [iso(29), iso(29, 1)], temp: [[10], [20]] }], ["temp"]);
    expect(sampleSeries(series, "temp", time(29) + HOUR / 2)).toMatchObject({ f: 0.5, exact: false });
    expect(sampleSeries(series, "temp", time(29, 1))).toMatchObject({ f: 0, exact: true });
    expect(sampleSeries(series, "temp", time(29) - HOUR)?.a).toBe(series.grids.temp[0]);
    expect(sampleSeries(series, "temp", time(29) - HOUR - 1)).toBeNull();
    expect(sampleSeries(series, "temp", time(29, 1) + HOUR + 1)).toBeNull();
    expect(sampleSeries(series, "missing", time(29))).toBeNull();
  });

  it("counts Bangkok calendar dates and chooses the focused day plus its neighbour", () => {
    expect(localDayIndex(time(30), time(29, 23))).toBe(1);
    expect(localDayIndex(time(28), time(29))).toBe(0);
    expect(localDayIndex(Date.parse("2026-10-10T00:00:00+07:00"), time(29))).toBe(6);
    expect(daysToLoad(4, new Set([0, 4]), new Set())).toEqual([5]);
    expect(daysToLoad(6, new Set(), new Set([6]))).toEqual([]);
  });
});
