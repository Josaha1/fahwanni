import "server-only";

import { toAgri, type AgriSnapshot } from "./agri";

/** Open-Meteo ET0 and soil moisture (free, CC BY 4.0); failures degrade to "not available". */
export async function fetchAgri(lat: number, lon: number, fetchImpl: typeof fetch = fetch): Promise<AgriSnapshot> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    daily: "et0_fao_evapotranspiration",
    hourly: "soil_moisture_0_to_1cm,soil_moisture_3_to_9cm",
    forecast_days: "2",
    forecast_hours: "1",
    timezone: "auto", // local days for the daily ET0 totals
  });
  try {
    const response = await fetchImpl(`https://api.open-meteo.com/v1/forecast?${params}`, { cache: "no-store", signal: AbortSignal.timeout(8_000) });
    return toAgri(response.ok ? await response.json() : null);
  } catch {
    return toAgri(null);
  }
}
