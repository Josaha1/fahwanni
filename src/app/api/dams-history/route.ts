import { after } from "next/server";
import { fetchDams } from "@/lib/dams/client";
import { buildHistory, historyDates, type DamHistory } from "@/lib/dams/history";
import { parseRidDams } from "@/lib/dams/rid";
import { WeatherCache } from "@/lib/weather/cache";

const cache = new WeatherCache<DamHistory>(() => Date.now(), 1, 23 * 60 * 60 * 1000);
const headers = { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=86400" };
let refreshing: Promise<DamHistory | null> | null = null;

async function fetchHistory(): Promise<DamHistory | null> {
  const today = await fetchDams();
  if (!today?.dataDate) return null;
  const dates = historyDates(today.dataDate);
  const reports = await Promise.all(Object.values(dates).map(async (date) => {
    try {
      const response = await fetch(`https://app.rid.go.th/reservoir/api/dam/public/${date}`, {
        next: { revalidate: 86400 }, signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) return null;
      const parsed = parseRidDams(await response.json());
      return parsed.dataDate === date && parsed.dams.length ? { date, dams: parsed.dams } : null;
    } catch { return null; }
  }));
  const history = buildHistory([{ date: today.dataDate, dams: today.dams },
    ...reports.filter((report): report is NonNullable<typeof report> => report !== null)]);
  return history.lastYear || history.year2554 ? history : null;
}

function refresh(): Promise<DamHistory | null> {
  refreshing ??= fetchHistory().then((history) => {
    if (history) cache.set("dams-history", history);
    return history;
  }).finally(() => { refreshing = null; });
  return refreshing;
}

export async function GET() {
  const fresh = cache.getFresh("dams-history");
  if (fresh) return Response.json(fresh, { headers });
  const stale = cache.getStale("dams-history");
  if (stale) {
    after(refresh);
    return Response.json(stale, { headers });
  }
  const history = await refresh();
  if (history) return Response.json(history, { headers });
  return Response.json({ error: "upstream" }, { status: 503, headers: { "Cache-Control": "no-store" } });
}
