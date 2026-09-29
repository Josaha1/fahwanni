import { describe, expect, it } from "vitest";
import { buildGrid, gridPoints } from "./grid";
import { fieldFromGrid, sampleField } from "./field";
import { windColor } from "../map/palette";
import { currentHourIndex, MAX_AGE, spawnArea, spawnParticle, speedColor, stepParticle, windMotion } from "./particles";

function uniformGrid(speedKmh: number, fromDeg: number) {
  const hourly = {
    time: ["2026-09-28T00:00", "2026-09-28T03:00"],
    wind_speed_10m: [speedKmh, speedKmh],
    wind_direction_10m: [fromDeg, fromDeg],
  };
  return buildGrid(gridPoints().map(() => ({ hourly })), 1)!;
}

describe("windMotion", () => {
  it.each([
    [{ reducedMotion: true, saveData: false }, false, 0],
    [{ reducedMotion: false, saveData: true }, false, 0],
    [{ reducedMotion: false, saveData: false }, true, 1200],
    [{ reducedMotion: false, saveData: false, deviceMemory: 2 }, true, 600],
    [{ reducedMotion: false, saveData: false, deviceMemory: 8 }, true, 1200],
  ])("%o", (env, animate, count) => {
    expect(windMotion(env)).toEqual({ animate, count });
  });
});

describe("stepParticle", () => {
  const westward = uniformGrid(36, 90); // from the east → moves west
  const field = fieldFromGrid(westward, 0)!;
  const sample = (lon: number, lat: number) => sampleField(field, lon, lat);

  it("moves with the wind and ages", () => {
    const next = stepParticle({ lon: 100, lat: 10, age: 0 }, sample, Math.random, field.bbox);
    expect(next.lon).toBeLessThan(100);
    expect(next.lat).toBeCloseTo(10);
    expect(next.age).toBe(1);
  });

  it("moves half as far in degrees per zoom level in", () => {
    const at6 = 100 - stepParticle({ lon: 100, lat: 10, age: 0 }, sample, Math.random, field.bbox, 6).lon;
    const at7 = 100 - stepParticle({ lon: 100, lat: 10, age: 0 }, sample, Math.random, field.bbox, 7).lon;
    expect(at7).toBeCloseTo(at6 / 2);
  });

  it("respawns inside the grid when too old or outside", () => {
    const seq = [0.5, 0.5, 0.1];
    const random = () => seq.shift() ?? 0;
    const old = stepParticle({ lon: 100, lat: 10, age: MAX_AGE }, sample, random, field.bbox);
    expect(old).toEqual({ lon: 101, lat: 13, age: 0 });
    const outside = stepParticle({ lon: 50, lat: 10, age: 3 }, sample, () => 0, field.bbox);
    expect(outside).toEqual({ lon: 92, lat: 4, age: 0 });
  });
});

describe("spawnParticle", () => {
  it("stays inside the bbox", () => {
    const grid = uniformGrid(10, 0);
    for (let i = 0; i < 50; i++) {
      const p = spawnParticle(grid.bbox);
      expect(p.lon).toBeGreaterThanOrEqual(92);
      expect(p.lon).toBeLessThanOrEqual(110);
      expect(p.lat).toBeGreaterThanOrEqual(4);
      expect(p.lat).toBeLessThanOrEqual(22);
      expect(p.age).toBeLessThan(MAX_AGE);
    }
  });
});

describe("spawnArea", () => {
  const grid = uniformGrid(10, 0);
  it("clips the viewport to the grid", () => {
    expect(spawnArea(grid.bbox, [99, 12, 102, 15])).toEqual([99, 12, 102, 15]);
    expect(spawnArea(grid.bbox, [85, 0, 100, 30])).toEqual([92, 4, 100, 22]);
  });
  it("falls back to the grid when the view is elsewhere or unknown", () => {
    expect(spawnArea(grid.bbox, [120, 25, 130, 30])).toEqual([92, 4, 110, 22]);
    expect(spawnArea(grid.bbox)).toEqual([92, 4, 110, 22]);
  });
  it("keeps zoomed-in spawns inside the view", () => {
    const area = spawnArea(grid.bbox, [100, 13, 101, 14]);
    for (let i = 0; i < 20; i++) {
      const p = spawnParticle(grid.bbox, Math.random, area);
      expect(p.lon).toBeGreaterThanOrEqual(100);
      expect(p.lon).toBeLessThanOrEqual(101);
    }
  });
});

describe("currentHourIndex", () => {
  const hours = ["2026-09-28T00:00:00.000Z", "2026-09-28T03:00:00.000Z", "2026-09-28T06:00:00.000Z"];
  it.each([
    ["2026-09-27T23:00:00Z", 0],
    ["2026-09-28T02:59:00Z", 0],
    ["2026-09-28T03:00:00Z", 1],
    ["2026-09-28T09:00:00Z", 2],
  ])("%s", (now, index) => expect(currentHourIndex(hours, now)).toBe(index));
});

describe("speedColor", () => {
  it("uses the shared map colours as wind strengthens", () => {
    expect(speedColor(2)).not.toBe(speedColor(15));
    for (const speed of [0, 3, 8, 14]) expect(speedColor(speed)).toBe(windColor(speed));
  });
});
