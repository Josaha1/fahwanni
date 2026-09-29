import { sampleGrid } from "../map/probe";
import { MIN_PROB, precipLevel } from "../precip/render";
import type { WindGrid } from "../wind/grid";
import { sampleSeries, type HourlySeries } from "./store";
import { lerpGrid } from "./time";

type Geo = Pick<WindGrid, "bbox" | "nx" | "ny">;

/** One variable at a place and time: interpolated between the bracketing hours, then in space. */
export function seriesValueAt(series: HourlySeries | null, variable: string, t: number, lon: number, lat: number, geo: Geo): number | null {
  if (!series?.grids[variable]) return null;
  const sample = sampleSeries(series, variable, t);
  if (!sample) return null;
  const values = sample.exact ? sample.a : lerpGrid(sample.a, sample.b, sample.f);
  return sampleGrid(geo, values, lon, lat);
}

/** Model rain level (0–4) at a place and time, using the same thresholds as the rain layer. */
export function modelRainLevelAt(series: HourlySeries | null, t: number, lon: number, lat: number, geo: Geo): number | null {
  const mm = seriesValueAt(series, "precip", t, lon, lat, geo);
  const prob = seriesValueAt(series, "prob", t, lon, lat, geo);
  if (mm === null || prob === null) return null;
  return prob < MIN_PROB ? 0 : precipLevel(mm);
}

export type PointHour = { time: number; temp: number | null; prob: number | null; precip: number | null };

/** Hourly temperature, rain chance and amount at a place for `hours` whole hours starting at the hour of `fromMs`. */
export function pointHours(series: HourlySeries | null, fromMs: number, lon: number, lat: number, geo: Geo, hours = 24): PointHour[] {
  if (!series) return [];
  const start = Math.floor(fromMs / 3_600_000) * 3_600_000;
  const result: PointHour[] = [];
  for (let index = 0; index < hours; index++) {
    const time = start + index * 3_600_000;
    // The sampler tolerates an hour past the series; a chart must not invent that hour.
    if (time > (series.times.at(-1) ?? -Infinity)) break;
    const hour = { time, temp: seriesValueAt(series, "temp", time, lon, lat, geo),
      prob: seriesValueAt(series, "prob", time, lon, lat, geo), precip: seriesValueAt(series, "precip", time, lon, lat, geo) };
    if (hour.temp === null && hour.prob === null) break;
    result.push(hour);
  }
  return result;
}
