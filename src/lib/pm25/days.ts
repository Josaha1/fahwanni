import { z } from "zod";
import { WIND_BBOX, WIND_NX, WIND_NY } from "@/lib/wind/grid";
import type { Pm25Grid } from "./grid";

export interface Pm25Day extends Pm25Grid {
  day: number;
  date: string;
}

const attribution = { text: "Air quality: Open-Meteo.com (CAMS, CC BY 4.0)", url: "https://open-meteo.com" } as const;
const locationSchema = z.object({ hourly: z.object({
  time: z.array(z.string()),
  pm2_5: z.array(z.number().nullable()),
}) });
const round = (n: number) => Math.round(n * 10) / 10 || 0;

/** Open-Meteo's Asia/Bangkok timestamps have no offset; their wall time is UTC+07:00. */
function thaiIso(time: string): string | null {
  if (!/^\d{4}-\d\d-\d\dT\d\d:00$/.test(time)) return null;
  const date = new Date(`${time}+07:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function fill(values: (number | null)[]): number[] | null {
  const first = values.find((value): value is number => value !== null);
  if (first === undefined) return null;
  let previous = first;
  return values.map((value) => {
    if (value !== null) previous = value;
    return previous;
  });
}

/** Missing values are filled within their own location and calendar day. */
export function buildPm25Days(locations: unknown[]): Pm25Day[] {
  const parsed = z.array(locationSchema).length(WIND_NX * WIND_NY).safeParse(locations);
  if (!parsed.success) return [];
  const rows = parsed.data.map(({ hourly }) => hourly);
  const times = rows[0].time;
  if (rows.some((row) => row.time.length !== times.length || row.pm2_5.length !== times.length ||
    row.time.some((time, index) => time !== times[index]))) return [];

  const dates = [...new Set(times.map((time) => time.slice(0, 10)))];
  if (dates.length !== 7 || times.length !== 168) return [];
  let lastDataIndex = times.length - 1;
  while (lastDataIndex >= 0 && rows.every((row) => row.pm2_5[lastDataIndex] === null)) lastDataIndex--;
  const days: Pm25Day[] = [];
  for (const [day, date] of dates.entries()) {
    const allIndices = times.map((time, index) => time.startsWith(`${date}T`) ? index : -1).filter((index) => index >= 0);
    if (allIndices.length !== 24 || allIndices[0] !== day * 24) continue;
    const indices = allIndices.filter((index) => index <= lastDataIndex);
    if (indices.length === 0) continue;
    const hours = indices.map((index) => thaiIso(times[index]));
    if (hours.some((hour) => hour === null) ||
      hours.some((hour, index) => hour !== new Date(Date.parse(hours[0]!) + index * 3_600_000).toISOString())) continue;
    const pm25: number[][] = hours.map(() => []);
    let valid = true;
    for (const row of rows) {
      const values = fill(indices.map((index) => row.pm2_5[index]));
      if (!values) { valid = false; break; }
      for (let hour = 0; hour < indices.length; hour++) pm25[hour].push(round(values[hour]));
    }
    if (valid) days.push({ day, date, bbox: WIND_BBOX, nx: WIND_NX, ny: WIND_NY,
      hours: hours as string[], pm25, source: "open-meteo-cams", attribution });
  }
  return days;
}

/** Rebuild the existing 24-hour response from the beginning of the current hour. */
export function toLegacyPm25Grid(days: Pm25Day[], nowMs: number): Pm25Grid {
  const start = Math.floor(nowMs / 3_600_000) * 3_600_000;
  const frames = days.flatMap((day) => day.hours.map((hour, index) => ({ day, index, ms: Date.parse(hour) })))
    .filter(({ ms }) => ms >= start && ms < start + 24 * 3_600_000);
  return { bbox: WIND_BBOX, nx: WIND_NX, ny: WIND_NY,
    hours: frames.map(({ day, index }) => day.hours[index]),
    pm25: frames.map(({ day, index }) => day.pm25[index]),
    source: "open-meteo-cams", attribution };
}
