import { parseTmdRain, type RainRisk } from "@/lib/rain-risk/tmd";
import { WeatherCache } from "@/lib/weather/cache";

const cache = new WeatherCache<RainRisk>(() => Date.now(), 1, 30 * 60 * 1000);
const headers = { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600" };
const source = "https://data.tmd.go.th/api/WeatherToday/V2/?uid=api&ukey=api12345&format=json";

export async function GET() {
  const fresh = cache.getFresh("rain-risk");
  if (fresh) return Response.json(fresh, { headers });
  try {
    const response = await fetch(source, { next: { revalidate: 1800 }, signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error(`TMD returned ${response.status}`);
    const raw: unknown = await response.json();
    const risk = parseTmdRain(raw);
    if (!risk.observedAt) throw new Error("TMD report missing observations");
    cache.set("rain-risk", risk);
    return Response.json(risk, { headers });
  } catch {
    const stale = cache.getStale("rain-risk");
    return Response.json(stale ?? { error: "upstream" }, { status: stale ? 200 : 503, headers: { "Cache-Control": "no-store" } });
  }
}
