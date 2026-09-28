import type { Position, Storm } from "./normalize";

type Coord = [number, number];
type Feature = {
  type: "Feature";
  properties: { id: string; kind: "track" | "forecast" | "cone" | "center"; name: string; category?: string; time?: string };
  geometry:
    | { type: "LineString"; coordinates: Coord[] }
    | { type: "Polygon"; coordinates: Coord[][] }
    | { type: "Point"; coordinates: Coord };
};
export type StormCollection = { type: "FeatureCollection"; features: Feature[] };

const toCoord = ({ lon, lat }: Position): Coord => [lon, lat];

/** Approximates a circle of `radiusKm` around `center` as a closed ring. */
export function circle(center: Position, radiusKm: number, steps = 48): Coord[] {
  const ring: Coord[] = [];
  const latRad = (center.lat * Math.PI) / 180;
  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * 2 * Math.PI;
    const dLat = (radiusKm / 111.32) * Math.cos(angle);
    const dLon = (radiusKm / (111.32 * Math.max(Math.cos(latRad), 0.01))) * Math.sin(angle);
    ring.push([center.lon + dLon, center.lat + dLat]);
  }
  return ring;
}

/** Past track, forecast line, forecast probability circles and the current centre for each storm. */
export function stormsToGeoJSON(storms: Storm[]): StormCollection {
  const features: Feature[] = [];
  for (const storm of storms) {
    const base = { id: storm.id, name: storm.name, category: storm.category };
    const past = storm.track.length > 0 ? [...storm.track.map(toCoord), toCoord(storm.position)] : [];
    if (past.length >= 2) {
      features.push({ type: "Feature", properties: { ...base, kind: "track" }, geometry: { type: "LineString", coordinates: past } });
    }
    const ahead = [toCoord(storm.position), ...storm.forecast.map(toCoord)];
    if (ahead.length >= 2) {
      features.push({ type: "Feature", properties: { ...base, kind: "forecast" }, geometry: { type: "LineString", coordinates: ahead } });
    }
    for (const point of storm.forecast) {
      if (!point.radiusKm) continue;
      features.push({
        type: "Feature",
        properties: { ...base, kind: "cone", time: point.time },
        geometry: { type: "Polygon", coordinates: [circle(point, point.radiusKm)] },
      });
    }
    features.push({ type: "Feature", properties: { ...base, kind: "center" }, geometry: { type: "Point", coordinates: toCoord(storm.position) } });
  }
  return { type: "FeatureCollection", features };
}
