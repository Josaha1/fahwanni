import { describe, expect, it } from "vitest";
import { damBandColor } from "./bands";
import { damGhosts, damSceneColors, reportedDamDays, waterLevel } from "./schematic";
import type { DamBand } from "./types";
import fixture from "./fixture-rid.json";
import { parseRidDams } from "./rid";

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


const dam = { ...parseRidDams(fixture).dams[0], date: "2026-10-05" };

it("selects only reported days in the seven-day window, including today's separate report", () => {
  const trend = { dates: ["2026-09-28", "2026-09-29", "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-06"],
    pct: { [dam.id]: [80, 0, null, 105, NaN, 90, 99] },
    release: { [dam.id]: [10, 0, null, 500, 12, null, 15] }, inflow: { [dam.id]: [null, 0, null, 100, 10, 200, 15] } };
  const days = reportedDamDays(dam, trend);
  expect(days.map((day) => day.date)).toEqual(["2026-09-29", "2026-10-02", "2026-10-04", "2026-10-05"]);
  expect(days[0]).toMatchObject({ storagePct: 0, releaseCms: 0, inflowCms: 0 });
  expect(days[1]).toMatchObject({ storagePct: 105, band: 5 });
  expect(days[2]).toMatchObject({ releaseCms: null, inflowCms: 200 });
  expect(days.at(-1)).toEqual(dam);
  expect(reportedDamDays(dam, null)).toEqual([dam]);
});

it("keeps ghost comparisons tied to their report day and omits invalid values", () => {
  const history = { dataDate: dam.date, lastYear: { date: "2025-10-05", pct: { [dam.id]: 0 } },
    year2554: { date: "2011-10-05", pct: { [dam.id]: 110 } } };
  expect(damGhosts(dam, history)).toEqual([{ key: "lastYear", date: "2025-10-05", pct: 0 }, { key: "year2554", date: "2011-10-05", pct: 110 }]);
  expect(damGhosts({ ...dam, date: "2026-10-04" }, history)).toEqual([]);
  expect(damGhosts(dam, { ...history, lastYear: null, year2554: { date: "2011-10-05", pct: { [dam.id]: NaN } } })).toEqual([]);
});

