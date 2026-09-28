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
  }),
});

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
  const hours = indices.map((i) => {
    const time = parsed.data[0].hourly.time[i];
    return new Date(/Z|[+-]\d\d:\d\d$/.test(time) ? time : `${time}Z`).toISOString();
  });
  const u: number[][] = hours.map(() => []);
  const v: number[][] = hours.map(() => []);
  for (const { hourly } of parsed.data) {
    indices.forEach((h, k) => {
      const { u: hu, v: hv } = toUV(hourly.wind_speed_10m[h] ?? 0, hourly.wind_direction_10m[h] ?? 0);
      u[k].push(round(hu));
      v[k].push(round(hv));
    });
  }
  return { bbox: WIND_BBOX, nx: WIND_NX, ny: WIND_NY, hours, u, v, source: "open-meteo", attribution };
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
