import "server-only";

import { buildGrid, gridPoints, type WindGrid } from "./grid";

const CHUNKS = 4;

function chunkUrl(points: { lat: number; lon: number }[]): string {
  const params = new URLSearchParams({
    latitude: points.map((p) => p.lat).join(","),
    longitude: points.map((p) => p.lon).join(","),
    // Rain and temperature ride along at the same locations (6 variables, under the 10-variable quota threshold).
    hourly: "wind_speed_10m,wind_direction_10m,precipitation,precipitation_probability,temperature_2m,apparent_temperature",
    wind_speed_unit: "kmh",
    forecast_hours: "24",
    timezone: "UTC",
  });
  return `https://api.open-meteo.com/v1/forecast?${params}`;
}

/**
 * One 361-point request takes ~18 s, so the grid is fetched as 4 parallel chunks.
 * Returns null on any failure; the route decides whether stale data can be served.
 */
export async function fetchWindGrid(fetchImpl: typeof fetch = fetch): Promise<WindGrid | null> {
  const points = gridPoints();
  const size = Math.ceil(points.length / CHUNKS);
  const chunks = Array.from({ length: CHUNKS }, (_, i) => points.slice(i * size, (i + 1) * size));
  try {
    const parts = await Promise.all(chunks.map(async (chunk) => {
      const response = await fetchImpl(chunkUrl(chunk), { next: { revalidate: 10800 }, signal: AbortSignal.timeout(30_000) });
      if (!response.ok) throw new Error(`open-meteo ${response.status}`);
      const body: unknown = await response.json();
      // A single location comes back as an object, several as an array.
      return Array.isArray(body) ? body : [body];
    }));
    return buildGrid(parts.flat());
  } catch {
    return null;
  }
}
