import { damBandColor } from "./bands";
import type { DamBand } from "./types";

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
