import { expect, it } from "vitest";
import { decodeTerrarium, terrariumGrid, terrariumTile, terrariumArea, terrainCoordinate, terrainPosition, terrainElevation, terrainSurfaceHeight } from "./terrarium";

it.each([[128, 0, 0, 0], [127, 255, 128, -0.5], [137, 219, 68, 2523.265625]])(
  "decodes (%s, %s, %s) to %s metres", (r, g, b, metres) => {
    expect(decodeTerrarium(r, g, b)).toBe(metres);
  });

it("retains original corner pixels and fractional elevations", () => {
  const grid = terrariumGrid([128, 0, 0, 255, 128, 1, 128, 255, 127, 255, 128, 255, 128, 2, 0, 255], 2, 2, 1);
  expect(grid).toEqual([0, 1.5, -0.5, 2]);
  expect(() => terrariumGrid([0, 0, 0, 255], 1, 1)).toThrow("Missing Terrarium");
  expect(() => terrariumGrid([], 2, 2)).toThrow("Invalid Terrarium");
});

it("locates the dam inside its Web Mercator tile, retaining offsets and metre scale", () => {
  expect(terrariumTile(0, 0, 1)).toMatchObject({ x: 1, y: 1, u: 0, v: 0 });
  const tile = terrariumTile(17.24, 98.97);
  expect(tile.url).toMatch(/terrarium\/12\/\d+\/\d+\.png$/);
  expect(tile.u).toBeGreaterThanOrEqual(0);
  expect(tile.u).toBeLessThan(1);
  expect(tile.v).toBeGreaterThanOrEqual(0);
  expect(tile.v).toBeLessThan(1);
  expect(tile.metres).toBeGreaterThan(9000);
  expect(tile.metres).toBeLessThan(10000);
  expect(terrariumTile(90, 180).x).toBe(0);
});

it("covers the complete 60 km neighbourhood with no more than four tiles", () => {
  for (const place of [{ lat: 13.7, lon: 100.5 }, { lat: 20.4, lon: 99.9 }, { lat: 6, lon: 101 }, { lat: 0, lon: 179.9 }]) {
    const area = terrariumArea(place);
    expect(area.length).toBeLessThanOrEqual(4);
    for (const x of [-30, 0, 30]) for (const z of [-30, 0, 30]) {
      const point = terrainCoordinate(place, x, z);
      const tile = terrariumTile(point.lat, point.lon, area[0].zoom);
      expect(area.some((entry) => entry.x === tile.x && entry.y === tile.y)).toBe(true);
      expect(terrainPosition(place, point).x).toBeCloseTo(x, 7);
      expect(terrainPosition(place, point).z).toBeCloseTo(z, 7);
    }
  }
});

it("samples elevation in metres without interpolating RGB channels", () => {
  const point = { lat: 0, lon: 0 };
  const tile = terrariumTile(0, 0, 1);
  const pixels = { ...tile, width: 2, height: 2, rgba: [128, 0, 0, 255, 128, 2, 0, 255, 128, 4, 0, 255, 128, 6, 0, 255] };
  expect(terrainElevation([pixels], point)).toBe(0);
  expect(terrainElevation([pixels], { lon: 90, lat: -66.51326044311186 })).toBeCloseTo(3);
  expect(() => terrainElevation([], point)).toThrow("Missing Terrarium tile");
});


it("places decals on both DEM triangles, including the boundary", () => {
  const heights = [0, 10, 20, 80];
  expect(terrainSurfaceHeight(heights, -15, -15, 1)).toBe(7.5);
  expect(terrainSurfaceHeight(heights, 15, 15, 1)).toBe(47.5);
  expect(terrainSurfaceHeight(heights, 30, 30, 1)).toBe(80);
  expect(terrainSurfaceHeight(heights, 0, 0, 1)).toBe(15);
});
