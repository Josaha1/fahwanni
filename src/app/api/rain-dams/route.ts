import { damRegistryById } from "@/lib/dams/registry";
import { damGrid, parseDamRain, type DamRain } from "@/lib/rain/dam-model";
import { WeatherCache } from "@/lib/weather/cache";

const cache = new WeatherCache<DamRain[]>(() => Date.now(), 200, 10800000);
const pending = new Map<string, Promise<DamRain[] | null>>();
const headers = { "Cache-Control": "public, s-maxage=10800, stale-while-revalidate=86400" };

export async function GET(request: Request) {
  const ids = [...new Set((new URL(request.url).searchParams.get("ids") ?? "").split(","))].sort();
  if (ids.length !== 3 || ids.some((id) => !damRegistryById.has(id))) return Response.json({ error: "bad_request" }, { status: 400 });
  const key = ids.join(",");
  const fresh = cache.getFresh(key);
  if (fresh) return Response.json(fresh, { headers });
  let loading = pending.get(key);
  if (!loading) {
    loading = (async () => {
      try {
        const dams = ids.map((id) => damRegistryById.get(id)!);
        const points = dams.flatMap(damGrid);
        const params = new URLSearchParams({ latitude: points.map((p) => p.lat.toFixed(4)).join(","), longitude: points.map((p) => p.lon.toFixed(4)).join(","), daily: "precipitation_sum", forecast_days: "7", timezone: "Asia/Bangkok" });
        const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { next: { revalidate: 10800 }, signal: AbortSignal.timeout(30000) });
        if (!response.ok) return null;
        const result = parseDamRain(await response.json(), dams);
        if (result) cache.set(key, result);
        return result;
      } catch { return null; }
      finally { pending.delete(key); }
    })();
    pending.set(key, loading);
  }
  const result = await loading;
  const data = result ?? cache.getStale(key);
  return Response.json(data ?? { error: "upstream" }, { status: data ? 200 : 503, headers: result ? headers : { "Cache-Control": "no-store" } });
}
