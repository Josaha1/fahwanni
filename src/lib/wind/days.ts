import { z } from "zod";
import { toUV, WIND_BBOX, WIND_NX, WIND_NY, type WindGrid } from "./grid";

export interface ForecastDay {
  day: number;
  date: string;
  bbox: readonly [number, number, number, number];
  nx: number;
  ny: number;
  hours: string[];
  u: number[][];
  v: number[][];
  precip: number[][];
  prob: number[][];
  temp: number[][];
  feels: number[][];
  source: "open-meteo";
  attribution: { text: string; url: string };
}

const attribution = { text: "Weather data by Open-Meteo.com (CC BY 4.0)", url: "https://open-meteo.com" };
const hourlySchema = z.object({
  time: z.array(z.string()),
  wind_speed_10m: z.array(z.number().nullable()),
  wind_direction_10m: z.array(z.number().nullable()),
  precipitation: z.array(z.number().nullable()),
  precipitation_probability: z.array(z.number().nullable()),
  temperature_2m: z.array(z.number().nullable()),
  apparent_temperature: z.array(z.number().nullable()),
});
const locationSchema = z.object({ hourly: hourlySchema });
const keys = ["wind_speed_10m", "wind_direction_10m", "precipitation", "precipitation_probability", "temperature_2m", "apparent_temperature"] as const;
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

/** A missing value is filled only within its own location and calendar day. */
export function buildDays(locations: unknown[]): ForecastDay[] {
  const parsed = z.array(locationSchema).length(WIND_NX * WIND_NY).safeParse(locations);
  if (!parsed.success) return [];
  const rows = parsed.data.map(({ hourly }) => hourly);
  const times = rows[0].time;
  if (rows.some((row) => row.time.length !== times.length ||
    row.time.some((time, index) => time !== times[index]) ||
    keys.some((key) => row[key].length !== times.length))) return [];

  const dates = [...new Set(times.map((time) => time.slice(0, 10)))];
  if (dates.length !== 7 || times.length !== 168) return [];
  let lastDataIndex = times.length - 1;
  while (lastDataIndex >= 0 && rows.every((row) => keys.every((key) => row[key][lastDataIndex] === null))) lastDataIndex--;
  const days: ForecastDay[] = [];
  for (const [day, date] of dates.entries()) {
    const allIndices = times.map((time, index) => time.startsWith(`${date}T`) ? index : -1).filter((index) => index >= 0);
    if (allIndices.length !== 24 || allIndices[0] !== day * 24) continue;
    const indices = allIndices.filter((index) => index <= lastDataIndex);
    if (indices.length === 0) continue;
    const hours = indices.map((index) => thaiIso(times[index]));
    if (hours.some((hour) => hour === null) ||
      hours.some((hour, index) => hour !== new Date(Date.parse(hours[0]!) + index * 3_600_000).toISOString())) continue;
    const fields = { u: [] as number[][], v: [] as number[][], precip: [] as number[][],
      prob: [] as number[][], temp: [] as number[][], feels: [] as number[][] };
    for (let hour = 0; hour < indices.length; hour++) {
      for (const field of Object.keys(fields) as (keyof typeof fields)[]) fields[field].push([]);
    }
    let valid = true;
    for (const row of rows) {
      const values = keys.map((key) => fill(indices.map((index) => row[key][index])));
      if (values.some((value) => value === null)) { valid = false; break; }
      const [speed, direction, precipitation, probability, temperature, apparent] = values as number[][];
      for (let hour = 0; hour < indices.length; hour++) {
        const { u, v } = toUV(speed[hour], direction[hour]);
        fields.u[hour].push(round(u));
        fields.v[hour].push(round(v));
        fields.precip[hour].push(round(precipitation[hour]));
        fields.prob[hour].push(Math.round(probability[hour]));
        fields.temp[hour].push(Math.round(temperature[hour]));
        fields.feels[hour].push(Math.round(apparent[hour]));
      }
    }
    if (valid) days.push({ day, date, bbox: WIND_BBOX, nx: WIND_NX, ny: WIND_NY,
      hours: hours as string[], ...fields, source: "open-meteo", attribution });
  }
  return days;
}

/** Rebuild the existing 3-hour wind, 12-hour rain, 24-hour temperature response from now. */
export function toLegacyGrid(days: ForecastDay[], nowMs: number): WindGrid {
  const start = Math.floor(nowMs / 3_600_000) * 3_600_000;
  const frames = days.flatMap((day) => day.hours.map((hour, index) => ({ day, index, ms: Date.parse(hour) })))
    .filter(({ ms }) => ms >= start && ms < start + 24 * 3_600_000);
  const wind = frames.filter(({ ms }) => (ms - start) % (3 * 3_600_000) === 0);
  const rain = frames.slice(0, 12);
  const pick = (items: typeof frames, field: "u" | "v" | "precip" | "prob" | "temp" | "feels") =>
    items.map(({ day, index }) => day[field][index]);
  return {
    bbox: WIND_BBOX, nx: WIND_NX, ny: WIND_NY,
    hours: wind.map(({ day, index }) => day.hours[index]), u: pick(wind, "u"), v: pick(wind, "v"),
    precipHours: rain.map(({ day, index }) => day.hours[index]), precip: pick(rain, "precip"), prob: pick(rain, "prob"),
    tempHours: frames.map(({ day, index }) => day.hours[index]), temp: pick(frames, "temp"), feels: pick(frames, "feels"),
    source: "open-meteo", attribution,
  };
}
