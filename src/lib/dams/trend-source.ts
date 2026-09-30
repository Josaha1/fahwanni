import "server-only";

import { fetchDams } from "./client";
import { parseRidDams } from "./rid";
import { buildTrend, trendDates, type DamTrend } from "./trend";
import { WeatherCache } from "../weather/cache";

const cache = new WeatherCache<DamTrend>(() => Date.now(), 1, 6 * 60 * 60 * 1000);
let refreshing: Promise<DamTrend | null> | null = null;

/** The last 7 RID daily reports plus today's; shared by /api/dams-trend and /api/rivers. */
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

export function refreshDamTrend(): Promise<DamTrend | null> {
  refreshing ??= fetchTrend().then((trend) => {
    if (trend) cache.set("dams-trend", trend);
    return trend;
  }).finally(() => { refreshing = null; });
  return refreshing;
}

/** Fresh or stale cached trend (stale triggers `refresh` via the caller's `after`), else a fetch. */
export async function getDamTrend(): Promise<{ trend: DamTrend; stale: boolean } | null> {
  const fresh = cache.getFresh("dams-trend");
  if (fresh) return { trend: fresh, stale: false };
  const stale = cache.getStale("dams-trend");
  if (stale) return { trend: stale, stale: true };
  const trend = await refreshDamTrend();
  return trend ? { trend, stale: false } : null;
}
