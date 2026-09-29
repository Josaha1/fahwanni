import { RAIN_RAMP } from "../map/palette";

/**
 * Radar-legend bins. Model drizzle below 0.3 mm/h is dropped: at 1° resolution it otherwise
 * paints most of the map pale blue and reads as "rain everywhere".
 */
export const MIN_MM = 0.3;
/** The rain strip and current renderer retain their existing probability threshold. */
export const MIN_PROB = 30;
/** Forecast rain on the map needs a stronger signal than the rain strip. */
export const MAP_MIN_PROB = 40;

type Rgba = [number, number, number, number];
export type RainMode = "blend" | "intensity" | "probability";

export function precipLevel(mm: number): number {
  if (mm < MIN_MM) return 0;
  if (mm < 1) return 1;
  if (mm < 4) return 2;
  if (mm < 10) return 3;
  return 4;
}

/** Kept for the existing renderer until the later renderer task switches to rainRgba. */
export function precipAlpha(probPct: number): number {
  return Math.round(Math.min(0.8, Math.max(0.25, probPct / 100)) * 255);
}

export function rainModeAt(leadMs: number): RainMode {
  if (leadMs <= 60 * 60_000) return "blend";
  if (leadMs <= 48 * 60 * 60_000) return "intensity";
  return "probability";
}

/** Mirrors MapLibre's raster shader factors and channel operations at the radar layer's settings. */
export function radarFilteredColor(hex: string): [number, number, number] {
  const channels = [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16) / 255);
  const saturationFactor = 1 - 1 / (1.001 - 0.35);
  const contrastFactor = 1 / (1 - 0.15);
  const average = (channels[0] + channels[1] + channels[2]) / 3;
  return channels.map((channel) => {
    const saturated = channel + (average - channel) * saturationFactor;
    return Math.round(Math.max(0, Math.min(1, (saturated - 0.5) * contrastFactor + 0.5)) * 255);
  }) as [number, number, number];
}

const RAIN_STOPS = [0.3, 1, 4, 10] as const;
const RADAR_COLORS = RAIN_RAMP.slice(1).map(radarFilteredColor);
const TRANSPARENT: Rgba = [0, 0, 0, 0];

/** Probability outlook: one radar-matched blue with three chance bands. */
export function probabilityRgba(probPct: number): Rgba {
  if (probPct < MAP_MIN_PROB) return [...TRANSPARENT];
  const alpha = probPct < 60 ? 0.4 : probPct < 80 ? 0.6 : 0.8;
  return [...RADAR_COLORS[1], Math.round(alpha * 255)];
}

/** Model intensity fades in over 0.3–0.8 mm/h and stays at most 60% opaque. */
export function rainRgba(mm: number, probPct: number, mode: RainMode): Rgba {
  if (mode === "probability") return probabilityRgba(probPct);
  if (probPct < MAP_MIN_PROB || mm <= MIN_MM) return [...TRANSPARENT];

  let color: readonly number[] = RADAR_COLORS[3];
  for (let i = 1; i < RAIN_STOPS.length; i++) {
    if (mm > RAIN_STOPS[i]) continue;
    const fraction = (mm - RAIN_STOPS[i - 1]) / (RAIN_STOPS[i] - RAIN_STOPS[i - 1]);
    color = RADAR_COLORS[i - 1].map((channel, index) =>
      Math.round(channel + (RADAR_COLORS[i][index] - channel) * fraction));
    break;
  }
  const alpha = Math.min(0.6, (mm - MIN_MM) / (0.8 - MIN_MM) * 0.6);
  return [color[0], color[1], color[2], Math.round(alpha * 255)];
}
