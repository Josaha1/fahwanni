import { parseLatLon, roundCoord } from "@/lib/geo";
import { toMarine, type MarineSnapshot } from "@/lib/marine";
import { fetchMarine } from "@/lib/marine-client";
import { WeatherCache } from "@/lib/weather/cache";

const cache = new WeatherCache<MarineSnapshot>(() => Date.now(), 200, 60 * 60 * 1000);
const headers = { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200" };

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const location = parseLatLon(params.get("lat"), params.get("lon"));
  if (!location) return Response.json({ error: "bad_request" }, { status: 400, headers: { "Cache-Control": "no-store" } });

  const lat = roundCoord(location.lat);
  const lon = roundCoord(location.lon);
  const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  const fresh = cache.getFresh(key);
  if (fresh) return Response.json(fresh, { headers });

  const marine = await fetchMarine(lat, lon);
  if (marine) {
    cache.set(key, marine);
    return Response.json(marine, { headers });
  }
  return Response.json(cache.getStale(key) ?? toMarine(null, lat, lon), { headers: { "Cache-Control": "no-store" } });
}
