import { describe, expect, it } from "vitest";
import { existsSync, statSync } from "node:fs";
import { hologramCoordinates, hologramOpacity, tileLat, tileLon } from "./hologram";

describe("hologram placement", () => {
  it("covers z6 tiles x48–51, y27–31 (90–112.5°E, 0–27.06°N)", () => {
    const [tl, tr, br, bl] = hologramCoordinates();
    expect(tl[0]).toBe(90);
    expect(tr[0]).toBe(112.5);
    expect(tl[1]).toBeCloseTo(27.059, 3);
    expect(br[1]).toBeCloseTo(0, 6);
    expect(bl).toEqual([tl[0], br[1]]);
    expect(tr[1]).toBe(tl[1]);
  });

  it("uses standard slippy-map tile math", () => {
    expect(tileLon(0, 6)).toBe(-180);
    expect(tileLat(32, 6)).toBeCloseTo(0, 9);
    expect(tileLat(0, 1)).toBeCloseTo(85.0511, 3);
  });

  it("fades out with zoom", () => {
    expect(hologramOpacity()).toEqual(["interpolate", ["linear"], ["zoom"], 7, 0.85, 9, 0]);
  });

  it("ships the rendered plate within the 350 KB budget", () => {
    const file = "public/map/hologram-terrain.webp";
    expect(existsSync(file)).toBe(true);
    expect(statSync(file).size).toBeLessThanOrEqual(350 * 1024);
  });
});
