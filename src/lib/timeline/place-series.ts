import { MIN_PROB, precipLevel } from "../precip/render";
import type { WindGrid } from "../wind/grid";
import type { HourlySeries } from "./store";
import { HOUR } from "./time";
import { seriesValueAt } from "./values";

export interface PlaceSeriesItem {
  time: string;
  kind: "radar" | "model";
  level: number;
  prob?: number;
}

/** Bilinear sample of a north-to-south, west-to-east scalar grid. */
export function sampleScalar(values: number[], nx: number, ny: number, bbox: WindGrid["bbox"], lon: number, lat: number): number | undefined {
  const [west, south, east, north] = bbox;
  if (lon < west || lon > east || lat < south || lat > north || nx < 1 || ny < 1 || values.length !== nx * ny) return undefined;
  const x = ((lon - west) / (east - west)) * (nx - 1);
  const y = ((north - lat) / (north - south)) * (ny - 1);
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const x1 = Math.min(x0 + 1, nx - 1), y1 = Math.min(y0 + 1, ny - 1);
  const fx = x - x0, fy = y - y0;
  return values[y0 * nx + x0] * (1 - fx) * (1 - fy) + values[y0 * nx + x1] * fx * (1 - fy) +
    values[y1 * nx + x0] * (1 - fx) * fy + values[y1 * nx + x1] * fx * fy;
}

/**
 * Rain at one place: "now" from the radar summary, then each of the next `hours` model hours
 * (starting at the next full hour) from the hourly forecast store.
 */
export function placeSeries(series: HourlySeries | null, nowMs: number, place: { lat: number; lon: number },
  geo: Pick<WindGrid, "bbox" | "nx" | "ny">, radarNow?: { overhead: boolean; heavyNearby: boolean }, hours = 12): PlaceSeriesItem[] {
  const [west, south, east, north] = geo.bbox;
  if (place.lon < west || place.lon > east || place.lat < south || place.lat > north) return [];
  const items: PlaceSeriesItem[] = [{ time: new Date(nowMs).toISOString(), kind: "radar", level: !radarNow?.overhead ? 0 : radarNow.heavyNearby ? 4 : 2 }];
  const firstHour = Math.floor(nowMs / HOUR) * HOUR + HOUR;
  const lastHour = series?.times.at(-1) ?? -Infinity;
  for (let h = 0; h < hours; h++) {
    const time = firstHour + h * HOUR;
    // Only hours the model actually covers (sampleSeries tolerates an hour beyond the data).
    if (time > lastHour) break;
    const mm = seriesValueAt(series, "precip", time, place.lon, place.lat, geo);
    const prob = seriesValueAt(series, "prob", time, place.lon, place.lat, geo);
    if (mm === null || prob === null) continue;
    items.push({ time: new Date(time).toISOString(), kind: "model", level: prob < MIN_PROB ? 0 : precipLevel(mm), prob });
  }
  return items;
}

export function firstRainHour(series: PlaceSeriesItem[], nowIso: string): number | null {
  const first = series.find((item) => item.kind === "model" && item.level > 0);
  return first ? Math.max(1, Math.ceil((Date.parse(first.time) - Date.parse(nowIso)) / 3_600_000)) : null;
}

export function placeSeriesSummary(series: PlaceSeriesItem[], nowIso: string): { key: string; params?: { n: number } } {
  const radar = series.find((item) => item.kind === "radar");
  if (radar?.level) return { key: "ตอนนี้มีฝน" };
  const hour = firstRainHour(series, nowIso);
  if (hour !== null) return radar
    ? { key: "ตอนนี้ไม่มีฝน, ฝนเริ่มราว +{n} ชม.", params: { n: hour } }
    : { key: "ฝนเริ่มราว +{n} ชม.", params: { n: hour } };
  return { key: radar ? "ตอนนี้ไม่มีฝน, ยังไม่พบฝนในช่วงพยากรณ์" : "ยังไม่พบฝนในช่วงพยากรณ์" };
}
