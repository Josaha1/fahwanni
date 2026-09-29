import type { DamBand } from "./types";

/**
 * Storage bands used in RID's daily reservoir reports (% of normal storage):
 * ≤ 30 น้ำน้อยวิกฤต, 31–50 น้ำน้อย, 51–80 ปานกลาง, 81–100 น้ำมาก, > 100 เกินความจุ.
 */
export function damBand(storagePct: number): DamBand {
  if (storagePct > 100) return 5;
  if (storagePct > 80) return 4;
  if (storagePct > 50) return 3;
  if (storagePct > 30) return 2;
  return 1;
}

const damColors = ["", "#FFC000", "#00B050", "#003CFA", "#FF0000", "#C70000"] as const;
const damWords = ["", "น้ำน้อยวิกฤต", "น้ำน้อย", "ปานกลาง", "น้ำมาก", "เกินความจุ"] as const;

export const damBandColor = (band: DamBand): string => damColors[band];
export const damBandWord = (band: DamBand): string => damWords[band];

/** Million m³/day → m³/s, one decimal. */
export const mcmDayToCms = (mcmDay: number | null): number | null =>
  mcmDay === null ? null : Math.round(mcmDay * 11.574 * 10) / 10;
