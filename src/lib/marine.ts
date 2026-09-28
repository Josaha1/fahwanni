import { z } from "zod";
import { distanceKm } from "./storms/normalize";

export type WaveLevel = "calm" | "moderate" | "high" | "very-high";

export interface MarineSnapshot {
  available: boolean;
  /** Distance from the requested place to the sea grid cell used. */
  cellKm?: number;
  nowWaveM?: number;
  maxWaveM?: number;
  periodS?: number;
  level?: WaveLevel;
  attribution: { text: string; url: string };
}

const attribution = { text: "Marine data by Open-Meteo.com (CC BY 4.0)", url: "https://open-meteo.com" };
export const MAX_CELL_KM = 30;

const schema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  hourly: z.object({
    time: z.array(z.string()),
    wave_height: z.array(z.number().nullable()),
    wave_period: z.array(z.number().nullable()).optional(),
  }),
});

/**
 * Plain-language wave bands for small-boat users (Thai Marine Department advice starts at
 * ~2 m for "งดออกจากฝั่ง" in monsoon warnings).
 */
export function waveLevel(m: number): WaveLevel {
  if (m < 0.5) return "calm";
  if (m < 1.5) return "moderate";
  if (m < 2.5) return "high";
  return "very-high";
}

/**
 * Open-Meteo Marine returns nulls for inland places and snaps coastal ones to the nearest sea
 * cell, so "no data" or "cell too far" both mean the place is not by the sea.
 */
export function toMarine(raw: unknown, lat: number, lon: number): MarineSnapshot {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { available: false, attribution };
  const { latitude, longitude, hourly } = parsed.data;
  const cellKm = Math.round(distanceKm({ lat, lon }, { lat: latitude, lon: longitude }));
  const waves = hourly.wave_height.filter((v): v is number => v !== null);
  if (waves.length === 0 || cellKm > MAX_CELL_KM) return { available: false, cellKm, attribution };
  const nowWaveM = hourly.wave_height.find((v): v is number => v !== null);
  const maxWaveM = Math.max(...waves);
  const periodS = hourly.wave_period?.find((v): v is number => v !== null) ?? undefined;
  return {
    available: true,
    cellKm,
    nowWaveM: nowWaveM === undefined ? undefined : Math.round(nowWaveM * 10) / 10,
    maxWaveM: Math.round(maxWaveM * 10) / 10,
    periodS: periodS === undefined ? undefined : Math.round(periodS),
    level: waveLevel(maxWaveM),
    attribution,
  };
}
