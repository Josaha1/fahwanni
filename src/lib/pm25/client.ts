import "server-only";

import { gridPoints } from "@/lib/wind/grid";
import { buildPm25Grid, type Pm25Grid } from "./grid";

const CHUNKS = 4;

function chunkUrl(points: { lat: number; lon: number }[]): string {
  const params = new URLSearchParams({
    latitude: points.map((p) => p.lat).join(","),
    longitude: points.map((p) => p.lon).join(","),
    hourly: "pm2_5",
    forecast_hours: "24",
    timezone: "UTC",
  });
  return `https://air-quality-api.open-meteo.com/v1/air-quality?${params}`;
}

/** Returns null on any upstream failure; the route may still serve a stale grid. */
export async function fetchPm25Grid(fetchImpl: typeof fetch = fetch): Promise<Pm25Grid | null> {
  const points = gridPoints();
  const size = Math.ceil(points.length / CHUNKS);
  const chunks = Array.from({ length: CHUNKS }, (_, i) => points.slice(i * size, (i + 1) * size));
  try {
    const parts = await Promise.all(chunks.map(async (chunk) => {
      const response = await fetchImpl(chunkUrl(chunk), { next: { revalidate: 10800 }, signal: AbortSignal.timeout(30_000) });
      if (!response.ok) throw new Error(`open-meteo ${response.status}`);
      const body: unknown = await response.json();
      return Array.isArray(body) ? body : [body];
    }));
    return buildPm25Grid(parts.flat());
  } catch {
    return null;
  }
}
