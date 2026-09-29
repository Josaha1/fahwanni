import { z } from "zod";
import { WIND_BBOX, WIND_NX, WIND_NY } from "@/lib/wind/grid";

export interface Pm25Grid {
  bbox: readonly [number, number, number, number];
  nx: number;
  ny: number;
  hours: string[];
  /** µg/m³, per hour then per grid point in gridPoints() order. */
  pm25: number[][];
  source: "open-meteo-cams";
  attribution: { text: "Air quality: Open-Meteo.com (CAMS, CC BY 4.0)"; url: "https://open-meteo.com" };
}

const locationSchema = z.object({
  hourly: z.object({
    time: z.array(z.string()),
    pm2_5: z.array(z.number().nullable()),
  }),
});

const toIso = (time: string) => new Date(/Z|[+-]\d\d:\d\d$/.test(time) ? time : `${time}+07:00`).toISOString();
const round = (n: number) => Math.round(n * 10) / 10 || 0;

/** Open-Meteo returns locations in request order; its snapped coordinates are not used. */
export function buildPm25Grid(locations: unknown[]): Pm25Grid | null {
  const parsed = z.array(locationSchema).length(WIND_NX * WIND_NY).safeParse(locations);
  if (!parsed.success) return null;

  const count = Math.min(24, parsed.data[0].hourly.time.length);
  if (!count || parsed.data.some(({ hourly }) =>
    hourly.time.length < count || hourly.pm2_5.length < count ||
    hourly.time.slice(0, count).some((time, index) => time !== parsed.data[0].hourly.time[index])
  )) return null;

  let hours: string[];
  try {
    hours = parsed.data[0].hourly.time.slice(0, count).map(toIso);
  } catch {
    return null;
  }

  const pm25: number[][] = hours.map(() => []);
  for (const { hourly } of parsed.data) {
    const values = hourly.pm2_5.slice(0, count);
    const first = values.find((value) => value !== null);
    if (first === undefined) return null;
    let previous = first;
    for (let hour = 0; hour < count; hour++) {
      previous = values[hour] ?? previous;
      pm25[hour].push(round(previous));
    }
  }

  return {
    bbox: WIND_BBOX, nx: WIND_NX, ny: WIND_NY, hours, pm25,
    source: "open-meteo-cams",
    attribution: { text: "Air quality: Open-Meteo.com (CAMS, CC BY 4.0)", url: "https://open-meteo.com" },
  };
}
