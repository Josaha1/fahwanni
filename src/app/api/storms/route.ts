import { fetchStorms, type StormSnapshot } from "@/lib/storms/client";
import { WeatherCache } from "@/lib/weather/cache";

const cache = new WeatherCache<StormSnapshot>(() => Date.now(), 1, 15 * 60 * 1000);
const headers = { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=1800" };

export async function GET() {
  const fresh = cache.getFresh("storms");
  if (fresh) return Response.json(fresh, { headers });

  const snapshot = await fetchStorms();
  cache.set("storms", snapshot);
  return Response.json(snapshot, { headers });
}
