import { after } from "next/server";
import { fetchDams } from "@/lib/dams/client";
import { parseRidDams } from "@/lib/dams/rid";
import { buildTrend, trendDates, type DamTrend } from "@/lib/dams/trend";
import { WeatherCache } from "@/lib/weather/cache";

const cache = new WeatherCache<DamTrend>(() => Date.now(), 1, 6 * 60 * 60 * 1000);
const headers = { "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400" };
let refreshing: Promise<DamTrend | null> | null = null;

async function fetchTrend(): Promise<DamTrend | null> {
  const today = await fetchDams();
  if (!today?.dataDate) return null;
  const reports = await Promise.all(trendDates(today.dataDate).map(async (date) => {
    try {
      const response = await fetch(`https://app.rid.go.th/reservoir/api/dam/public/${date}`, {
        next: { revalidate: 21600 }, signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) return null;
      const parsed = parseRidDams(await response.json());
      return parsed.dataDate === date && parsed.dams.length ? { date, dams: parsed.dams } : null;
    } catch { return null; }
  }));
  return buildTrend([...reports.filter((report): report is NonNullable<typeof report> => report !== null),
    { date: today.dataDate, dams: today.dams }]);
}

function refresh(): Promise<DamTrend | null> {
  refreshing ??= fetchTrend().then((trend) => {
    if (trend) cache.set("dams-trend", trend);
    return trend;
  }).finally(() => { refreshing = null; });
  return refreshing;
}

export async function GET() {
  const fresh = cache.getFresh("dams-trend");
  if (fresh) return Response.json(fresh, { headers });
  const stale = cache.getStale("dams-trend");
  if (stale) {
    after(refresh);
    return Response.json(stale, { headers });
  }
  const trend = await refresh();
  if (trend) return Response.json(trend, { headers });
  return Response.json({ error: "upstream" }, { status: 503, headers: { "Cache-Control": "no-store" } });
}
