import { alongKm } from "../dams/geo.mjs";

/**
 * Dams whose downstream route passes within `maxKm` of a river point, nearest (by river distance from the
 * dam) first. Both the gauge location and the snapped model cell are tried, as either may sit off the line.
 */
export function upstreamDamsOf(point, paths, maxKm = 5) {
  const spots = [[point.lon, point.lat]];
  if (point.snappedLat !== undefined && point.snappedLon !== undefined) spots.push([point.snappedLon, point.snappedLat]);
  const found = [];
  for (const path of paths) {
    if (path.coordinates.length < 2) continue;
    const best = spots.map((spot) => alongKm(spot, path.coordinates)).reduce((a, b) => (b.distanceKm < a.distanceKm ? b : a));
    if (best.distanceKm <= maxKm) found.push({ damId: path.damId, km: Math.round(best.km) });
  }
  return found.sort((a, b) => a.km - b.km);
}
