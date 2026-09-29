import "server-only";

import { gridPoints } from "@/lib/wind/grid";
import type { Pm25Grid } from "./grid";
import { buildPm25Days, toLegacyPm25Grid, type Pm25Day } from "./days";

const CHUNKS = 4;

function chunkUrl(points: { lat: number; lon: number }[]): string {
  const params = new URLSearchParams({
    latitude: points.map((p) => p.lat).join(","),
    longitude: points.map((p) => p.lon).join(","),
    hourly: "pm2_5",
    forecast_days: "7",
    timezone: "Asia/Bangkok",
  });
  return `https://air-quality-api.open-meteo.com/v1/air-quality?${params}`;
}

/** Returns null on any upstream failure; the route may still serve stale days. */
export async function fetchPm25Days(fetchImpl: typeof fetch = fetch): Promise<Pm25Day[] | null> {
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
    const days = buildPm25Days(parts.flat());
    return days.length ? days : null;
  } catch {
    return null;
  }
}

export async function fetchPm25Grid(fetchImpl: typeof fetch = fetch, now = Date.now()): Promise<Pm25Grid | null> {
  const days = await fetchPm25Days(fetchImpl);
  return days ? toLegacyPm25Grid(days, now) : null;
}
