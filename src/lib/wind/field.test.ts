import { describe, expect, it } from "vitest";
import type { HourlySeries } from "../timeline/store";
import { fieldFromGrid, sampleField, windFieldAt } from "./field";
import type { WindGrid } from "./grid";
import { stepParticle } from "./particles";

const geo = { bbox: [0, 0, 1, 1] as const, nx: 2, ny: 2 };
const at14 = Date.parse("2026-09-29T14:00:00Z");
const series: HourlySeries = {
  times: [at14, at14 + 3_600_000],
  grids: {
    u: [new Float32Array([0, 2, 4, 6]), new Float32Array([2, 4, 6, 8])],
    v: [new Float32Array([2, 2, 2, 2]), new Float32Array([6, 6, 6, 6])],
  },
};

describe("wind field", () => {
  it("interpolates both components at 14:30 before bilinear sampling", () => {
    const field = windFieldAt(series, at14 + 30 * 60_000, geo)!;
    expect(Array.from(field.u)).toEqual([1, 3, 5, 7]);
    expect(Array.from(field.v)).toEqual([4, 4, 4, 4]);
    expect(sampleField(field, 0.5, 0.5)).toEqual({ u: 4, v: 4 });
    const next = stepParticle({ lon: 0.5, lat: 0.5, age: 0 }, (lon, lat) => sampleField(field, lon, lat), Math.random, geo.bbox);
    expect(next.lon).toBeGreaterThan(0.5);
    expect(next.lat).toBeGreaterThan(0.5);
  });

  it("returns the exact model hour and reuses output arrays", () => {
    const out = windFieldAt(series, at14, geo)!;
    const u = out.u, v = out.v;
    expect(Array.from(out.u)).toEqual([0, 2, 4, 6]);
    expect(windFieldAt(series, at14 + 3_600_000, geo, out)).toBe(out);
    expect(out.u).toBe(u);
    expect(out.v).toBe(v);
    expect(Array.from(out.u)).toEqual([2, 4, 6, 8]);
    expect(Array.from(out.v)).toEqual([6, 6, 6, 6]);
  });

  it("rejects positions outside the bbox and unavailable hours", () => {
    const field = windFieldAt(series, at14, geo)!;
    expect(sampleField(field, 1.1, 0.5)).toBeUndefined();
    expect(sampleField(field, 0.5, -0.1)).toBeUndefined();
    expect(windFieldAt(series, at14 - 3_600_001, geo)).toBeNull();
  });

  it("copies the selected legacy hour for fallback", () => {
    const grid = { ...geo, hours: [new Date(at14).toISOString()], u: [[1, 2, 3, 4]], v: [[5, 6, 7, 8]],
      source: "open-meteo" as const, attribution: { text: "", url: "" } } satisfies WindGrid;
    expect(sampleField(fieldFromGrid(grid, 0)!, 0.5, 0.5)).toEqual({ u: 2.5, v: 6.5 });
    expect(fieldFromGrid(grid, 1)).toBeNull();
  });
});
