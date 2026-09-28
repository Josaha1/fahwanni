export function roundCoord(value: number): number {
  return Math.round(value * 100) / 100;
}

function coordinate(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && value.trim() === "") return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseLatLon(lat: unknown, lon: unknown): { lat: number; lon: number } | null {
  const latitude = coordinate(lat);
  const longitude = coordinate(lon);
  if (latitude === null || longitude === null || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return null;
  }

  return { lat: latitude, lon: longitude };
}

export function cacheKey(lat: number, lon: number, lang: "th" | "en"): string {
  return `${roundCoord(lat).toFixed(2)},${roundCoord(lon).toFixed(2)},${lang}`;
}
