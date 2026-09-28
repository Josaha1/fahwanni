import { z } from "zod";

export const WIND_BBOX = [92, 4, 110, 22] as const;
export const WIND_NX = 19;
export const WIND_NY = 19;

export interface WindGrid {
  bbox: readonly [number, number, number, number];
  nx: number;
  ny: number;
  hours: string[];
  u: number[][];
  v: number[][];
  /** Model rain for the next hours (hourly, from the current hour). Optional: CDN copies from
   *  before this field existed may still be served for up to 3 h after a deploy. */
  precipHours?: string[];
  /** mm in the hour, per hour then per grid point (same order as u/v). */
  precip?: number[][];
  /** Probability of precipitation, %, same shape as precip. */
  prob?: number[][];
  /** Hourly temperature timestamps. Optional: CDN copies from before this field existed may
   *  still be served for up to 3 h after a deploy. */
  tempHours?: string[];
  /** Temperature in °C, rounded to integers; per hour then per grid point (same order as u/v). */
  temp?: number[][];
  /** Apparent temperature in °C, same shape as temp. */
  feels?: number[][];
  source: "open-meteo";
  attribution: { text: string; url: string };
}

const attribution = { text: "Weather data by Open-Meteo.com (CC BY 4.0)", url: "https://open-meteo.com" };

/** Grid points row-major from north (lat 22) to south, west to east. */
export function gridPoints(): { lat: number; lon: number }[] {
  const [west, south, east, north] = WIND_BBOX;
  const points: { lat: number; lon: number }[] = [];
  for (let row = 0; row < WIND_NY; row++) {
    for (let col = 0; col < WIND_NX; col++) {
      points.push({
        lat: north - (row * (north - south)) / (WIND_NY - 1),
        lon: west + (col * (east - west)) / (WIND_NX - 1),
      });
    }
  }
  return points;
}

/** Meteorological "from" direction + speed in km/h → u/v components in m/s. */
export function toUV(speedKmh: number, fromDeg: number): { u: number; v: number } {
  const s = speedKmh / 3.6;
  const rad = (fromDeg * Math.PI) / 180;
  return { u: -s * Math.sin(rad), v: -s * Math.cos(rad) };
}

const round = (n: number) => Math.round(n * 10) / 10 || 0;

const locationSchema = z.object({
  hourly: z.object({
    time: z.array(z.string()),
    wind_speed_10m: z.array(z.number().nullable()),
    wind_direction_10m: z.array(z.number().nullable()),
    precipitation: z.array(z.number().nullable()).optional(),
    precipitation_probability: z.array(z.number().nullable()).optional(),
    temperature_2m: z.array(z.number().nullable()).optional(),
    apparent_temperature: z.array(z.number().nullable()).optional(),
  }),
});

export const PRECIP_HOURS = 12;
const toIso = (time: string) => new Date(/Z|[+-]\d\d:\d\d$/.test(time) ? time : `${time}Z`).toISOString();

/**
 * Builds the grid from Open-Meteo per-location responses in request order
 * (returned coordinates are snapped to the model grid, so they are not used).
 * Keeps every `stepHours`-th hour: 24 hourly frames would be ~77 KB of JSON.
 */
export function buildGrid(locations: unknown[], stepHours = 3): WindGrid | null {
  const parsed = z.array(locationSchema).length(WIND_NX * WIND_NY).safeParse(locations);
  if (!parsed.success) return null;
  const indices = parsed.data[0].hourly.time.map((_, i) => i).filter((i) => i % stepHours === 0);
  // Requested with timezone=UTC, so times come back without an offset ("2026-09-28T07:00").
  const hours = indices.map((i) => toIso(parsed.data[0].hourly.time[i]));
  const u: number[][] = hours.map(() => []);
  const v: number[][] = hours.map(() => []);
  for (const { hourly } of parsed.data) {
    indices.forEach((h, k) => {
      const { u: hu, v: hv } = toUV(hourly.wind_speed_10m[h] ?? 0, hourly.wind_direction_10m[h] ?? 0);
      u[k].push(round(hu));
      v[k].push(round(hv));
    });
  }
  const grid: WindGrid = { bbox: WIND_BBOX, nx: WIND_NX, ny: WIND_NY, hours, u, v, source: "open-meteo", attribution };
  if (parsed.data.every(({ hourly }) => hourly.precipitation && hourly.precipitation_probability)) {
    const n = Math.min(PRECIP_HOURS, parsed.data[0].hourly.time.length);
    grid.precipHours = parsed.data[0].hourly.time.slice(0, n).map(toIso);
    grid.precip = grid.precipHours.map(() => []);
    grid.prob = grid.precipHours.map(() => []);
    for (const { hourly } of parsed.data) {
      for (let h = 0; h < n; h++) {
        grid.precip[h].push(round(hourly.precipitation![h] ?? 0));
        grid.prob[h].push(Math.round(hourly.precipitation_probability![h] ?? 0));
      }
    }
  }
  const tempCount = Math.min(24, parsed.data[0].hourly.time.length);
  if (parsed.data.every(({ hourly }) => hourly.temperature_2m && hourly.apparent_temperature &&
    hourly.temperature_2m.length >= tempCount && hourly.apparent_temperature.length >= tempCount &&
    hourly.temperature_2m.slice(0, tempCount).every((value) => value !== null) &&
    hourly.apparent_temperature.slice(0, tempCount).every((value) => value !== null))) {
    grid.tempHours = parsed.data[0].hourly.time.slice(0, tempCount).map(toIso);
    grid.temp = grid.tempHours.map(() => []);
    grid.feels = grid.tempHours.map(() => []);
    for (const { hourly } of parsed.data) {
      for (let hour = 0; hour < tempCount; hour++) {
        grid.temp[hour].push(Math.round(hourly.temperature_2m![hour]!));
        grid.feels[hour].push(Math.round(hourly.apparent_temperature![hour]!));
      }
    }
  }
  return grid;
}

/** Bilinear sample of u/v at a position; undefined outside the grid. */
export function sampleAt(grid: WindGrid, hourIndex: number, lon: number, lat: number): { u: number; v: number } | undefined {
  const [west, south, east, north] = grid.bbox;
  if (lon < west || lon > east || lat < south || lat > north) return undefined;
  const us = grid.u[hourIndex];
  const vs = grid.v[hourIndex];
  if (!us || !vs) return undefined;
  const x = ((lon - west) / (east - west)) * (grid.nx - 1);
  const y = ((north - lat) / (north - south)) * (grid.ny - 1);
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const x1 = Math.min(x0 + 1, grid.nx - 1), y1 = Math.min(y0 + 1, grid.ny - 1);
  const fx = x - x0, fy = y - y0;
  const at = (arr: number[], cx: number, cy: number) => arr[cy * grid.nx + cx];
  const lerp = (arr: number[]) =>
    at(arr, x0, y0) * (1 - fx) * (1 - fy) + at(arr, x1, y0) * fx * (1 - fy) +
    at(arr, x0, y1) * (1 - fx) * fy + at(arr, x1, y1) * fx * fy;
  return { u: lerp(us), v: lerp(vs) };
}
