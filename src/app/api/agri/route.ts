import { fetchAgri } from "@/lib/agri-client";
import type { AgriSnapshot } from "@/lib/agri";
import { parseLatLon, roundCoord } from "@/lib/geo";
import { WeatherCache } from "@/lib/weather/cache";

const cache = new WeatherCache<AgriSnapshot>(() => Date.now(), 200, 3 * 60 * 60 * 1000);
const headers = { "Cache-Control": "public, s-maxage=10800, stale-while-revalidate=21600" };

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const location = parseLatLon(params.get("lat"), params.get("lon"));
  if (!location) return Response.json({ error: "bad_request" }, { status: 400, headers: { "Cache-Control": "no-store" } });

  const lat = roundCoord(location.lat);
  const lon = roundCoord(location.lon);
  const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  const fresh = cache.getFresh(key);
  if (fresh) return Response.json(fresh, { headers });

  const agri = await fetchAgri(lat, lon);
  cache.set(key, agri);
  return Response.json(agri, { headers });
}
