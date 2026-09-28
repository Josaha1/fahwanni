import "server-only";

import { normalizeAir, type AirSnapshot } from "./air";
import { WeatherError } from "./weather/client";

export async function fetchAir(
  lat: number,
  lon: number,
  lang: "th" | "en",
  fetchImpl: typeof fetch = fetch,
): Promise<AirSnapshot> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key?.trim()) throw new WeatherError("no_key");

  const url = new URL("https://airquality.googleapis.com/v1/currentConditions:lookup");
  url.searchParams.set("key", key);

  try {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: { latitude: lat, longitude: lon },
        universalAqi: true,
        extraComputations: ["LOCAL_AQI", "POLLUTANT_CONCENTRATION"],
        languageCode: lang,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      if (response.status === 403) throw new WeatherError("forbidden");
      if (response.status === 429) throw new WeatherError("quota");
      throw new WeatherError("upstream");
    }
    return normalizeAir(await response.json());
  } catch (error) {
    if (error instanceof WeatherError) throw error;
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new WeatherError("timeout");
    }
    throw new WeatherError("upstream");
  }
}
