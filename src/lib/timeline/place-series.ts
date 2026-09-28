import { MIN_PROB, precipLevel } from "../precip/render";
import type { WindGrid } from "../wind/grid";
import type { TimelineStop } from "./frames";

export interface PlaceSeriesItem {
  time: string;
  kind: TimelineStop["kind"];
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

export function placeSeries(grid: WindGrid, stops: TimelineStop[], place: { lat: number; lon: number }, radarNow?: { overhead: boolean; heavyNearby: boolean }): PlaceSeriesItem[] {
  const [west, south, east, north] = grid.bbox;
  if (place.lon < west || place.lon > east || place.lat < south || place.lat > north) return [];
  const newestRadar = stops.findLast((stop) => stop.kind === "radar");
  return stops.flatMap((stop): PlaceSeriesItem[] => {
    if (stop.kind === "radar") {
      if (stop !== newestRadar) return [];
      return [{ time: stop.time, kind: "radar", level: !radarNow?.overhead ? 0 : radarNow.heavyNearby ? 4 : 2 }];
    }
    const mm = grid.precip?.[stop.index];
    const probabilities = grid.prob?.[stop.index];
    if (!mm || !probabilities) return [];
    const rain = sampleScalar(mm, grid.nx, grid.ny, grid.bbox, place.lon, place.lat);
    const prob = sampleScalar(probabilities, grid.nx, grid.ny, grid.bbox, place.lon, place.lat);
    if (rain === undefined || prob === undefined) return [];
    return [{ time: stop.time, kind: "model", level: prob < MIN_PROB ? 0 : precipLevel(rain), prob }];
  });
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
