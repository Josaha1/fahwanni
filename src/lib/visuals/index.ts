import { damBand, damBandColor } from "@/lib/dams/bands";
import type { FloodSample, PixelCounts } from "@/lib/flood/viirs";
import { parseLatLon } from "@/lib/geo";
import { rainCategory } from "@/lib/rain-risk/tmd";
import { bearingDeg, distanceKm, type Position } from "@/lib/storms/normalize";

export type NoData = { state: "no-data" };
const noData: NoData = { state: "no-data" };
const present = (value: number | null): value is number => value !== null && Number.isFinite(value) && value >= 0;

function capped(value: number | null, cap: number) {
  if (!present(value) || !Number.isFinite(cap) || cap <= 0) return noData;
  return { state: "data" as const, value, shown: Math.min(value, cap), ratio: Math.min(value / cap, 1), capped: value > cap };
}

/** Caps affect geometry only; captions and categories retain the reported value. */
export function rainGauge(mm: number | null, capMm: number) {
  const gauge = capped(mm, capMm);
  return gauge.state === "no-data" ? gauge : { ...gauge, category: rainCategory(gauge.value) };
}

/** Height is linear in % capacity; the crest remains at 1 even above capacity. */
export function tankFill(pct: number | null, capPct: number) {
  if (!Number.isFinite(capPct) || capPct <= 100) return noData;
  const fill = capped(pct, capPct);
  if (fill.state === "no-data") return fill;
  const band = damBand(fill.value);
  return { ...fill, height: fill.shown / 100, crest: 1, band, color: damBandColor(band) };
}

export type StreamUnit = "cms" | "mm";

export function streamRate(value: number | null, unit: StreamUnit, cap: number) {
  const rate = capped(value, cap);
  return rate.state === "no-data" ? rate : { ...rate, unit };
}

export type SatelliteSample = Pick<FloodSample, "lat" | "lon" | "kind">;

/** Local east/north kilometres preserve distance from the centre, including across the date line. */
export function satelliteRing(samples: readonly SatelliteSample[] | null, place: Position | null, radiusKm = 30) {
  if (samples === null || place === null || !parseLatLon(place.lat, place.lon) || !Number.isFinite(radiusKm) || radiusKm <= 0) return noData;
  const points = samples.flatMap((sample) => {
    if (!parseLatLon(sample.lat, sample.lon)) return [];
    const distance = distanceKm(place, sample);
    if (distance > radiusKm) return [];
    const bearing = bearingDeg(place, sample) * Math.PI / 180;
    return [{ ...sample, eastKm: distance * Math.sin(bearing), northKm: distance * Math.cos(bearing) }];
  });
  if (!points.length) return noData;
  const flood = points.filter((point) => point.kind === "flood" || point.kind === "recurring-flood").length;
  const insufficient = points.filter((point) => point.kind === "insufficient-data" || point.kind === "no-data").length;
  return { state: insufficient === points.length ? "no-data" as const : "data" as const, radiusKm, points, flood, insufficient };
}

export function provinceBins(counts: PixelCounts | null) {
  if (counts === null || !Object.values(counts).every((value) => present(value) && Number.isInteger(value)) ||
    counts.sampled === 0 || counts.insufficientData + counts.noData >= counts.sampled) return noData;
  const count = counts.flood + counts.recurringFlood;
  const bin = count === 0 ? 0 : count <= 20 ? 1 : count <= 200 ? 2 : 3;
  return { state: "data" as const, count, bin };
}

export { visualSummaryRain, visualSummaryTank, visualSummarySatellite, visualSummaryProvince, visualSummaryStream } from "./summaries";
