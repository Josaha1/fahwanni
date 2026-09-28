import { describe, expect, it } from "vitest";
import { existsSync, statSync } from "node:fs";
import { reliefCoordinates, reliefOpacity, reliefUrl, tileLat, tileLon } from "./relief";

describe("relief placement", () => {
  it("covers z6 tiles x48–51, y27–31 (90–112.5°E, 0–27.06°N)", () => {
    const [tl, tr, br, bl] = reliefCoordinates();
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

  it("selects the active theme's plate and opacity", () => {
    expect(reliefUrl("light")).toBe("/map/relief-light.webp");
    expect(reliefUrl("dark")).toBe("/map/relief-dark.webp");
    expect(reliefOpacity("light")).toEqual(["interpolate", ["linear"], ["zoom"], 7, 0.9, 9, 0]);
    expect(reliefOpacity("dark")).toEqual(["interpolate", ["linear"], ["zoom"], 7, 0.85, 9, 0]);
  });

  it("keeps rendered plates within 220 KB when Blender outputs are present", () => {
    for (const theme of ["light", "dark"] as const) {
      const file = `public${reliefUrl(theme)}`;
      if (existsSync(file)) expect(statSync(file).size).toBeLessThanOrEqual(220 * 1024);
    }
  });
});
