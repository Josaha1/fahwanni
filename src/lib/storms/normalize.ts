export type Position = { lat: number; lon: number };

export type Storm = {
  id: string;
  source: "jma" | "gdacs";
  name: string;
  category?: string;
  alertLevel?: "Green" | "Orange" | "Red";
  position: Position;
  windKmh?: number;
  pressureHpa?: number;
  issuedAt?: string;
  track: (Position & { time?: string })[];
  forecast: (Position & { time: string; radiusKm?: number })[];
  url?: string;
};

export function inStormBbox({ lat, lon }: Position): boolean {
  return lat >= 0 && lat <= 30 && lon >= 80 && lon <= 130;
}

const radians = (degrees: number) => (degrees * Math.PI) / 180;

export function distanceKm(a: Position, b: Position): number {
  const latDiff = radians(b.lat - a.lat);
  const lonDiff = radians(b.lon - a.lon);
  const halfChord = Math.sin(latDiff / 2) ** 2 +
    Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(lonDiff / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(halfChord)));
}

export function bearingDeg(a: Position, b: Position): number {
  const lonDiff = radians(b.lon - a.lon);
  const y = Math.sin(lonDiff) * Math.cos(radians(b.lat));
  const x = Math.cos(radians(a.lat)) * Math.sin(radians(b.lat)) -
    Math.sin(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.cos(lonDiff);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function sameDay(a: Storm, b: Storm): boolean {
  if (!a.issuedAt || !b.issuedAt) return false;
  const first = Date.parse(a.issuedAt);
  const second = Date.parse(b.issuedAt);
  return Number.isFinite(first) && Number.isFinite(second) &&
    new Date(first).toISOString().slice(0, 10) === new Date(second).toISOString().slice(0, 10);
}

export function mergeStorms(jma: Storm[], gdacs: Storm[]): Storm[] {
  const result = [...jma];
  for (const storm of gdacs) {
    if (!jma.some((other) => sameDay(other, storm) && distanceKm(other.position, storm.position) < 300)) {
      result.push(storm);
    }
  }
  return result;
}
