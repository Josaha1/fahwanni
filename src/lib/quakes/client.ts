import "server-only";

import { parseUsgs, QUAKE_BBOX, type Quake } from "./usgs";

/** M ≥ 4 in the region for the last 7 days; failures give an empty list. */
export async function fetchQuakes(now = new Date(), fetchImpl: typeof fetch = fetch): Promise<Quake[] | null> {
  const params = new URLSearchParams({
    format: "geojson",
    minlatitude: String(QUAKE_BBOX.minLat),
    maxlatitude: String(QUAKE_BBOX.maxLat),
    minlongitude: String(QUAKE_BBOX.minLon),
    maxlongitude: String(QUAKE_BBOX.maxLon),
    minmagnitude: "4",
    starttime: new Date(now.getTime() - 7 * 86_400_000).toISOString().slice(0, 19),
    orderby: "time",
  });
  try {
    const response = await fetchImpl(`https://earthquake.usgs.gov/fdsnws/event/1/query?${params}`, { next: { revalidate: 600 }, signal: AbortSignal.timeout(10_000) });
    return response.ok ? parseUsgs(await response.json()) : null;
  } catch {
    return null;
  }
}
