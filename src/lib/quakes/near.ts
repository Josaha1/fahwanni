import { bearingDeg, distanceKm, type Position } from "../storms/normalize";
import type { Quake } from "./usgs";

export interface NearbyQuake extends Quake {
  distanceKm: number;
  bearingDeg: number;
}

export const QUAKE_ATTRIBUTION = { text: "Earthquakes: USGS", url: "https://earthquake.usgs.gov" };

/** Quakes within `radiusKm` of a place in the last `days`, newest first. */
export function nearbyQuakes(quakes: Quake[], place: Position, nowIso: string, radiusKm = 1000, days = 7): NearbyQuake[] {
  const since = Date.parse(nowIso) - days * 86_400_000;
  return quakes
    .filter((q) => Date.parse(q.time) >= since)
    .map((q) => ({ ...q, distanceKm: Math.round(distanceKm(place, q)), bearingDeg: Math.round(bearingDeg(place, q)) }))
    .filter((q) => q.distanceKm <= radiusKm)
    .sort((a, b) => Date.parse(b.time) - Date.parse(a.time));
}
