import { describe, expect, it } from "vitest";
import { damBandColor } from "./bands";
import { damSceneColors, waterLevel } from "./model3d";
import type { DamBand } from "./types";

describe("schematic water level", () => {
  it.each([[0, 0], [25, 0.5], [50, Math.sqrt(0.5)], [100, 1], [110, Math.sqrt(1.1)],
    [121, 1.1], [200, 1.1], [-10, 0]])("maps %s%% to height %s", (pct, height) => {
    expect(waterLevel(pct)).toBeCloseTo(height);
  });

  it.each([NaN, Infinity, -Infinity])("maps non-finite %s to zero", (pct) => {
    expect(waterLevel(pct)).toBe(0);
  });
});

describe("dam scene colours", () => {
  it.each([1, 2, 3, 4, 5] as DamBand[])("keeps band %s colours in both themes with darker deep water", (band) => {
    for (const theme of ["light", "dark"] as const) {
      const colors = damSceneColors(theme, band);
      expect(colors.water).toBe(damBandColor(band));
      for (const value of Object.values(colors)) expect(value).toMatch(/^#[\da-f]{6}$/i);
      for (const start of [1, 3, 5]) {
        const channel = parseInt(colors.water.slice(start, start + 2), 16);
        expect(Math.abs(parseInt(colors.waterDeep.slice(start, start + 2), 16) - channel * 0.7)).toBeLessThanOrEqual(0.5);
      }
      expect(colors.rimLastYear).toBe("#64748b");
      expect(colors.rim2554).toBe("#e11d48");
    }
  });

  it("uses the specified terrain, wall and background for each theme", () => {
    expect(damSceneColors("light", 3)).toMatchObject({ terrain: "#d8cdb4", wall: "#b9bec7", background: "#eef4fb" });
    expect(damSceneColors("dark", 3)).toMatchObject({ terrain: "#3b4150", wall: "#6b7280", background: "#141a26" });
  });
});
