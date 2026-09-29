import { after } from "next/server";
import { parseTide, type TideSeries } from "@/lib/tide/tide";
import { WeatherCache } from "@/lib/weather/cache";

const cache = new WeatherCache<TideSeries>(() => Date.now(), 1, 3 * 60 * 60 * 1000);
const headers = { "Cache-Control": "public, s-maxage=10800, stale-while-revalidate=86400" };
const url = "https://marine-api.open-meteo.com/v1/marine?latitude=13.5&longitude=100.6&hourly=sea_level_height_msl&forecast_days=3&timezone=Asia%2FBangkok";
let refreshing: Promise<TideSeries | null> | null = null;

function refresh(): Promise<TideSeries | null> {
  refreshing ??= (async () => {
    try {
      const response = await fetch(url, { next: { revalidate: 10800 }, signal: AbortSignal.timeout(15_000) });
      if (!response.ok) return null;
      const series = parseTide(await response.json());
      if (series) cache.set("mouth", series);
      return series;
    } catch { return null; }
  })().finally(() => { refreshing = null; });
  return refreshing;
}

export async function GET() {
  const fresh = cache.getFresh("mouth");
  if (fresh) return Response.json(fresh, { headers });
  const stale = cache.getStale("mouth");
  if (stale) {
    after(refresh);
    return Response.json(stale, { headers });
  }
  const series = await refresh();
  if (series) return Response.json(series, { headers });
  return Response.json({ error: "upstream" }, { status: 503, headers: { "Cache-Control": "no-store" } });
}
