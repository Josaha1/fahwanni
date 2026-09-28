import { z } from "zod";
import { bearingDeg, distanceKm, type Position } from "../storms/normalize";

export interface Quake {
  id: string;
  mag: number;
  place: string;
  time: string; // ISO
  lat: number;
  lon: number;
  depthKm: number;
  tsunami: boolean;
  url?: string;
}

export interface NearbyQuake extends Quake {
  distanceKm: number;
  bearingDeg: number;
}

/** USGS covers Thailand's neighbourhood: Myanmar, Laos, Sumatra/Andaman, southern China. */
export const QUAKE_BBOX = { minLat: -5, maxLat: 30, minLon: 85, maxLon: 115 } as const;
export const QUAKE_ATTRIBUTION = { text: "Earthquakes: USGS", url: "https://earthquake.usgs.gov" };

const featureSchema = z.object({
  id: z.string(),
  properties: z.object({
    mag: z.number().nullable(),
    place: z.string().nullable().optional(),
    time: z.number(),
    tsunami: z.number().optional(),
    url: z.string().optional(),
    type: z.string().optional(),
  }),
  geometry: z.object({ coordinates: z.tuple([z.number(), z.number(), z.number()]).rest(z.number()) }),
});
const collectionSchema = z.object({ features: z.array(z.unknown()) });

/** Lenient parse: bad features are skipped, not fatal. Only real earthquakes (not blasts). */
export function parseUsgs(raw: unknown): Quake[] {
  const parsed = collectionSchema.safeParse(raw);
  if (!parsed.success) return [];
  return parsed.data.features.flatMap((item) => {
    const f = featureSchema.safeParse(item);
    if (!f.success || f.data.properties.mag === null) return [];
    const { properties: p, geometry } = f.data;
    if (p.type && p.type !== "earthquake") return [];
    const [lon, lat, depth] = geometry.coordinates;
    return [{
      id: f.data.id, mag: Math.round(p.mag! * 10) / 10, place: p.place ?? "", time: new Date(p.time).toISOString(),
      lat, lon, depthKm: Math.round(depth), tsunami: p.tsunami === 1, url: p.url,
    }];
  });
}

/** Quakes within `radiusKm` of a place in the last `days`, newest first. */
export function nearbyQuakes(quakes: Quake[], place: Position, nowIso: string, radiusKm = 1000, days = 7): NearbyQuake[] {
  const since = Date.parse(nowIso) - days * 86_400_000;
  return quakes
    .filter((q) => Date.parse(q.time) >= since)
    .map((q) => ({ ...q, distanceKm: Math.round(distanceKm(place, q)), bearingDeg: Math.round(bearingDeg(place, q)) }))
    .filter((q) => q.distanceKm <= radiusKm)
    .sort((a, b) => Date.parse(b.time) - Date.parse(a.time));
}
