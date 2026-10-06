import { damBand, damBandColor } from "./bands";
import type { Dam, DamBand } from "./types";
import type { DamHistory } from "./history";
import { trendDates, type DamTrend } from "./trend";

/** V-shaped schematic valley (volume ∝ height²), not measured bathymetry. */
export function waterLevel(pct: number): number {
  return Number.isFinite(pct) ? Math.sqrt(Math.min(121, Math.max(0, pct)) / 100) : 0;
}

export function damSceneColors(theme: "light" | "dark", band: DamBand) {
  const water = damBandColor(band);
  const waterDeep = `#${[1, 3, 5].map((start) =>
    Math.round(parseInt(water.slice(start, start + 2), 16) * 0.7).toString(16).padStart(2, "0")).join("")}`;
  return {
    water, waterDeep,
    terrain: theme === "light" ? "#d8cdb4" : "#3b4150",
    wall: theme === "light" ? "#b9bec7" : "#6b7280",
    background: theme === "light" ? "#eef4fb" : "#141a26",
    rimLastYear: "#64748b",
    rim2554: "#e11d48",
  };
}

/** Calendar window includes today; missing reports never become selectable or zero. */
export function reportedDamDays(dam: Dam, trend?: DamTrend | null): Dam[] {
  const dates = [...trendDates(dam.date, 6), dam.date];
  return dates.flatMap((date) => {
    if (date === dam.date) return [dam];
    const index = trend?.dates.indexOf(date) ?? -1;
    const pct = trend?.pct[dam.id]?.[index];
    if (pct == null || !Number.isFinite(pct) || pct < 0) return [];
    return [{ ...dam, date, storagePct: pct, band: damBand(pct),
      releaseCms: trend?.release[dam.id]?.[index] ?? null,
      inflowCms: trend?.inflow[dam.id]?.[index] ?? null }];
  });
}

export function damGhosts(dam: Dam, history?: DamHistory | null) {
  if (history?.dataDate !== dam.date) return [];
  return (["lastYear", "year2554"] as const).flatMap((key) => {
    const entry = history[key];
    const pct = entry?.pct[dam.id];
    return pct != null && Number.isFinite(pct) && pct >= 0 ? [{ key, date: entry!.date, pct }] : [];
  });
}

