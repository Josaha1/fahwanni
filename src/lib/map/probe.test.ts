import { describe, expect, it } from "vitest";
import { modelRainAt, sampleGrid, windAt } from "./probe";
import type { WindGrid } from "../wind/grid";

const grid = { bbox: [0, 0, 1, 1] as const, nx: 2, ny: 2 };
const wind = { ...grid, hours: ["2026-09-28T00:00:00Z"], u: [[1, 1, 1, 1]], v: [[0, 0, 0, 0]], source: "open-meteo" as const, attribution: { text: "", url: "" } } satisfies WindGrid;

describe("map probe", () => {
  it("samples north-to-south row-major grid points and the midpoint", () => {
    expect(sampleGrid(grid, [1, 2, 3, 4], 0, 1)).toBe(1);
    expect(sampleGrid(grid, [1, 2, 3, 4], 0.5, 0.5)).toBe(2.5);
  });
  it("rejects outside and invalid corners", () => {
    expect(sampleGrid(grid, [1, 2, 3, 4], 2, 0.5)).toBeNull();
    expect(sampleGrid(grid, [1, 2, NaN, 4], 0.5, 0.5)).toBeNull();
    expect(sampleGrid(grid, [1, 2, 3], 0.5, 0.5)).toBeNull();
  });
  it("converts eastward m/s to wind from west in km/h", () => {
    expect(windAt(wind, 0, 0.5, 0.5)).toEqual({ speedKmh: 4, fromDeg: 270 });
  });
  it("selects earliest highest rain level after the probability threshold", () => {
    const rainy = { ...wind, precip: [[5, 5, 5, 5], [1, 1, 1, 1], [5, 5, 5, 5]], prob: [[20, 20, 20, 20], [80, 80, 80, 80], [80, 80, 80, 80]] };
    expect(modelRainAt(rainy, 0.5, 0.5)).toEqual({ level: 3, hourIndex: 2 });
    expect(modelRainAt({ ...rainy, prob: [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]] }, 0.5, 0.5)).toEqual({ level: 0, hourIndex: 0 });
    expect(modelRainAt(wind, 0.5, 0.5)).toBeNull();
  });
});
