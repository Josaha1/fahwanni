import "server-only";

import { normalize } from "./normalize";
import { currentConditionsSchema, forecastDaysSchema, forecastHoursSchema, publicAlertsSchema } from "./schema";
import type { WeatherSnapshot } from "./types";

export type WeatherErrorCode = "no_key" | "forbidden" | "quota" | "upstream" | "timeout";

export class WeatherError extends Error {
  constructor(public readonly code: WeatherErrorCode) {
    super(code);
    this.name = "WeatherError";
  }
}

async function getJson(url: URL, fetchImpl: typeof fetch, optional = false): Promise<unknown> {
  try {
    const response = await fetchImpl(url, {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      if (optional) return {};
      if (response.status === 403) throw new WeatherError("forbidden");
      if (response.status === 429) throw new WeatherError("quota");
      throw new WeatherError("upstream");
    }

    return await response.json();
  } catch (error) {
    if (optional) return {};
    if (error instanceof WeatherError) throw error;
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new WeatherError("timeout");
    }
    throw new WeatherError("upstream");
  }
}

export async function fetchWeather(
  lat: number,
  lon: number,
  lang: "th" | "en",
  fetchImpl: typeof fetch = fetch,
): Promise<WeatherSnapshot> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key?.trim()) throw new WeatherError("no_key");

  const params = new URLSearchParams({
    key,
    "location.latitude": String(lat),
    "location.longitude": String(lon),
    languageCode: lang,
    unitsSystem: "METRIC",
  });
  const url = (path: string, extra?: Record<string, string>) => {
    const result = new URL(path, "https://weather.googleapis.com");
    result.search = params.toString();
    for (const [name, value] of Object.entries(extra ?? {})) result.searchParams.set(name, value);
    return result;
  };

  const [current, hours, days, alerts] = await Promise.all([
    getJson(url("/v1/currentConditions:lookup"), fetchImpl),
    getJson(url("/v1/forecast/hours:lookup", { hours: "24", pageSize: "24" }), fetchImpl),
    getJson(url("/v1/forecast/days:lookup", { days: "10", pageSize: "10" }), fetchImpl),
    getJson(url("/v1/publicAlerts:lookup"), fetchImpl, true),
  ]);

  try {
    const parsedAlerts = publicAlertsSchema.safeParse(alerts);
    return normalize(
      currentConditionsSchema.parse(current),
      forecastHoursSchema.parse(hours),
      forecastDaysSchema.parse(days),
      parsedAlerts.success ? parsedAlerts.data : {},
    );
  } catch {
    throw new WeatherError("upstream");
  }
}
