import { TZDate } from "@date-fns/tz";
import type { WeatherDay, WeatherHour } from "./weather/types";

export type SoilWord = "dry" | "moist" | "wet";

/**
 * Rough words for volumetric soil moisture. Field capacity is ~0.30 for loam, lower for sand
 * and higher for clay, so this is a guide, not a measurement of the user's field.
 */
export function soilWord(m3: number): SoilWord {
  if (m3 < 0.15) return "dry";
  if (m3 < 0.3) return "moist";
  return "wet";
}

/** Total forecast rain over the first `n` days (day + night parts). */
export function rainTotalMm(days: WeatherDay[], n = 10): number {
  const total = days.slice(0, n).reduce((sum, day) => sum + (day.day.rainMm ?? 0) + (day.night.rainMm ?? 0), 0);
  return Math.round(total);
}

const DRY_HOURS = 6;

/**
 * Earliest daytime hour (06–18 local) in the next 24 h that is good for spraying: wind below
 * 10 km/h with gusts below 20, and under 20 % rain chance that hour and the following 5 hours
 * so the spray is not washed off.
 */
export function sprayWindow(hours: WeatherHour[], timeZone: string, nowIso: string): string | undefined {
  const now = Date.parse(nowIso);
  const ahead = hours.filter((hour) => hour.startTime && Date.parse(hour.startTime) + 3600_000 > now && Date.parse(hour.startTime) < now + 24 * 3600_000);
  for (let i = 0; i + DRY_HOURS <= ahead.length; i++) {
    const hour = ahead[i];
    const local = new TZDate(hour.startTime!, timeZone).getHours();
    if (local < 6 || local > 18) continue;
    if ((hour.windKmh ?? 99) >= 10 || (hour.gustKmh ?? 0) >= 20) continue;
    if (ahead.slice(i, i + DRY_HOURS).every((h) => (h.rainChance ?? 100) < 20)) return hour.startTime;
  }
  return undefined;
}
