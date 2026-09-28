import { parseTmdWarnings, type TmdWarnings } from "@/lib/tmd";
import { WeatherCache } from "@/lib/weather/cache";

const cache = new WeatherCache<TmdWarnings>(() => Date.now(), 1, 15 * 60 * 1000);
const headers = { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=1800" };
const source = "https://data.tmd.go.th/api/WeatherWarningNews/v2/?uid=api&ukey=api12345";

export async function GET() {
  const fresh = cache.getFresh("tmd-warnings");
  if (fresh) return Response.json(fresh, { headers });

  try {
    const response = await fetch(source, { next: { revalidate: 900 }, signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error(`TMD returned ${response.status}`);
    const warnings = parseTmdWarnings(await response.text());
    cache.set("tmd-warnings", warnings);
    return Response.json(warnings, { headers });
  } catch {
    const fallback = { items: [], error: "upstream" as const };
    return Response.json(cache.getStale("tmd-warnings") ?? fallback, { headers: { "Cache-Control": "no-store" } });
  }
}
