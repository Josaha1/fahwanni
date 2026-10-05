import type { ReportingRainStation } from "@/lib/rain-risk/tmd";
import type { DamTrend } from "@/lib/dams/trend";
import { distanceKm, type Position } from "@/lib/storms/normalize";
import { provinces } from "@/lib/provinces";
import type { FloodEvent } from "@/lib/water/flood-events";
import type { FloodRegion, PixelCounts } from "@/lib/flood/viirs";

export type FloodNowPayload = {
  date: string; regionCounts: Record<FloodRegion, PixelCounts>; provinceCounts: Record<string, PixelCounts>;
  nearMe?: { verdict: "flood" | "not-seen" | "cloud-or-no-data" };
};
export const floodRegions: Record<FloodRegion, string> = {
  north: "ภาคเหนือ", northeast: "ภาคตะวันออกเฉียงเหนือ", central: "ภาคกลาง",
  east: "ภาคตะวันออก", west: "ภาคตะวันตก", south: "ภาคใต้",
};

export function nearestRainStation(stations: ReportingRainStation[], place: Position) {
  return stations.map((station) => ({ station, km: distanceKm(place, station) }))
    .sort((a, b) => a.km - b.km || a.station.id.localeCompare(b.station.id))[0] ?? null;
}

export function riskBbox(place: Position): string {
  const latDelta = 10 / 111.2;
  const lonDelta = latDelta / Math.cos(place.lat * Math.PI / 180);
  return [place.lon - lonDelta, place.lat - latDelta, place.lon + lonDelta, place.lat + latDelta].join(",");
}

export function previousRelease(trend: DamTrend | null, id: string, date: string): number | null {
  const at = Date.parse(`${date}T00:00:00Z`);
  if (!trend || !Number.isFinite(at)) return null;
  const yesterday = new Date(at - 86_400_000).toISOString().slice(0, 10);
  const index = trend.dates.indexOf(yesterday);
  return index < 0 ? null : trend.release[id]?.[index] ?? null;
}

export function recentFloodEvents(items: FloodEvent[], nowMs: number): FloodEvent[] {
  return items.filter((event) => {
    const start = Date.parse(`${event.date}T00:00:00+07:00`);
    const at = Date.parse(`${event.endDate ?? event.date}T00:00:00+07:00`);
    return (event.type === "flood" || event.type === "flash-flood") && start <= nowMs && nowMs - at <= 14 * 86_400_000;
  });
}

// Country-wide event coordinates are not province locations. Count only provinces
// named in the published place, leaving unspecified places in the national list.
export function eventProvinces(event: FloodEvent) {
  return provinces.filter((province) => event.place.includes(province.th)
    || new RegExp(`\\b${province.en.replaceAll(" ", "\\s*")}\\b`, "i").test(event.place));
}

export function warningRegions(text: string): FloodRegion[] {
  return (Object.keys(floodRegions) as FloodRegion[]).filter((region) =>
    // The east prefix also appears in northeast; don't count that as an east warning.
    (region === "east" ? text.replaceAll(floodRegions.northeast, "") : text).includes(floodRegions[region]));
}
