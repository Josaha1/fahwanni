import { fetchQuakes } from "@/lib/quakes/client";
import type { Quake } from "@/lib/quakes/usgs";
import { WeatherCache } from "@/lib/weather/cache";

const cache = new WeatherCache<Quake[]>(() => Date.now(), 1, 10 * 60 * 1000);
const headers = { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1800" };

export async function GET() {
  const fresh = cache.getFresh("quakes");
  if (fresh) return Response.json({ quakes: fresh }, { headers });
  const quakes = await fetchQuakes();
  cache.set("quakes", quakes);
  return Response.json({ quakes }, { headers });
}
