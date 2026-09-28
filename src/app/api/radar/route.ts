import { fetchRadar } from "@/lib/radar/client";
import type { RadarManifest } from "@/lib/radar/types";
import { WeatherCache } from "@/lib/weather/cache";

const cache = new WeatherCache<RadarManifest>(() => Date.now(), 1, 5 * 60 * 1000);
const headers = { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" };

export async function GET() {
  const fresh = cache.getFresh("radar");
  if (fresh) return Response.json(fresh, { headers });

  const manifest = await fetchRadar();
  if (manifest.provider === "rainviewer") {
    cache.set("radar", manifest);
    return Response.json(manifest, { headers });
  }
  return Response.json(cache.getStale("radar") ?? manifest, { headers: { "Cache-Control": "no-store" } });
}
