/** One radar pixel relative to the user: offsets in km (east, north) and whether it shows rain. */
export interface RadarSample {
  eastKm: number;
  northKm: number;
  rain: boolean;
  heavy: boolean;
}

export interface RadarSummary {
  /** Rain within ~5 km of the user. */
  overhead: boolean;
  /** Distance to the nearest rain pixel within the search radius. */
  nearestKm?: number;
  bearingDeg?: number;
  heavyNearby: boolean;
}

/**
 * RainViewer colour scheme 2 ("Universal Blue"): transparent = dry, blues = light–moderate,
 * yellow/orange/red = heavy. Pixels are classified by colour, not calibrated dBZ.
 */
export function classifyPixel(r: number, g: number, b: number, a: number): { rain: boolean; heavy: boolean } {
  if (a < 64) return { rain: false, heavy: false };
  return { rain: true, heavy: r > 200 && b < 120 };
}

export function summarizeRadar(samples: RadarSample[], radiusKm = 100): RadarSummary {
  let nearest: RadarSample | undefined;
  let nearestKm = Infinity;
  let heavyNearby = false;
  for (const s of samples) {
    if (!s.rain) continue;
    const km = Math.hypot(s.eastKm, s.northKm);
    if (km > radiusKm) continue;
    if (s.heavy && km <= 30) heavyNearby = true;
    if (km < nearestKm) { nearestKm = km; nearest = s; }
  }
  if (!nearest) return { overhead: false, heavyNearby: false };
  const bearing = (Math.atan2(nearest.eastKm, nearest.northKm) * 180 / Math.PI + 360) % 360;
  return { overhead: nearestKm <= 5, nearestKm: Math.round(nearestKm), bearingDeg: Math.round(bearing), heavyNearby };
}

/** Web-Mercator position of lon/lat in global pixels at zoom z (256 px tiles). */
export function globalPixel(lon: number, lat: number, z: number): { x: number; y: number } {
  const scale = 256 * 2 ** z;
  const sin = Math.sin((lat * Math.PI) / 180);
  return {
    x: ((lon + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
  };
}

/** Ground size of one pixel at zoom z and latitude. */
export function kmPerPixel(lat: number, z: number): number {
  return (40075.017 * Math.cos((lat * Math.PI) / 180)) / (256 * 2 ** z);
}
