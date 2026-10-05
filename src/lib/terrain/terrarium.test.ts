import { expect, it } from "vitest";
import { decodeTerrarium, terrariumGrid, terrariumTile } from "./terrarium";

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
