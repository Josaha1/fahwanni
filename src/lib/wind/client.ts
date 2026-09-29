import "server-only";

import { gridPoints, type WindGrid } from "./grid";
import { buildDays, toLegacyGrid, type ForecastDay } from "./days";

// Seven hourly variables: five chunks keep each response under Next's 2 MB data-cache limit.
const CHUNKS = 5;

function chunkUrl(points: { lat: number; lon: number }[]): string {
  const params = new URLSearchParams({
    latitude: points.map((p) => p.lat).join(","),
    longitude: points.map((p) => p.lon).join(","),
    // Rain, temperature and cloud ride along at the same locations (7 variables, under the 10-variable quota threshold).
    hourly: "wind_speed_10m,wind_direction_10m,precipitation,precipitation_probability,temperature_2m,apparent_temperature,cloud_cover",
    wind_speed_unit: "kmh",
    // Six hourly variables and seven days stay within Open-Meteo's 1x quota tier.
    forecast_days: "7",
    timezone: "Asia/Bangkok",
  });
  return `https://api.open-meteo.com/v1/forecast?${params}`;
}

/**
 * One 361-point request takes ~18 s, so the grid is fetched as 4 parallel chunks.
 * Returns null on any failure; the route decides whether stale data can be served.
 */
export async function fetchWindDays(fetchImpl: typeof fetch = fetch): Promise<ForecastDay[] | null> {
  const points = gridPoints();
  const size = Math.ceil(points.length / CHUNKS);
  const chunks = Array.from({ length: CHUNKS }, (_, i) => points.slice(i * size, (i + 1) * size));
  try {
    const parts = await Promise.all(chunks.map(async (chunk) => {
      // About 90 locations x 168 hours per chunk keeps each response under Next's 2 MB data-cache limit.
      const response = await fetchImpl(chunkUrl(chunk), { next: { revalidate: 10800 }, signal: AbortSignal.timeout(30_000) });
      if (!response.ok) throw new Error(`open-meteo ${response.status}`);
      const body: unknown = await response.json();
      // A single location comes back as an object, several as an array.
      return Array.isArray(body) ? body : [body];
    }));
    const days = buildDays(parts.flat());
    return days.length ? days : null;
  } catch {
    return null;
  }
}

export async function fetchWindGrid(fetchImpl: typeof fetch = fetch, now = Date.now()): Promise<WindGrid | null> {
  const days = await fetchWindDays(fetchImpl);
  return days ? toLegacyGrid(days, now) : null;
}
