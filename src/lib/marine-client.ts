import "server-only";

import { toMarine, type MarineSnapshot } from "./marine";

/** Open-Meteo Marine (free, CC BY 4.0); failures degrade to "not available", never throw. */
export async function fetchMarine(lat: number, lon: number, fetchImpl: typeof fetch = fetch): Promise<MarineSnapshot | null> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    hourly: "wave_height,wave_period",
    forecast_hours: "24",
    timezone: "UTC",
  });
  try {
    const response = await fetchImpl(`https://marine-api.open-meteo.com/v1/marine?${params}`, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(8_000) });
    if (!response.ok) return null;
    return toMarine(await response.json(), lat, lon);
  } catch {
    return null;
  }
}
