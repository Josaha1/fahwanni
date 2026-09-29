import { after } from "next/server";
import { fetchWindDays } from "@/lib/wind/client";
import { toLegacyGrid, type ForecastDay } from "@/lib/wind/days";
import { WeatherCache } from "@/lib/weather/cache";

const cache = new WeatherCache<ForecastDay[]>(() => Date.now(), 1, 3 * 60 * 60 * 1000);
const headers = { "Cache-Control": "public, s-maxage=10800, stale-while-revalidate=86400" };
let refreshing: Promise<ForecastDay[] | null> | null = null;

function refresh(): Promise<ForecastDay[] | null> {
  refreshing ??= fetchWindDays()
    .then((days) => {
      if (days) cache.set("wind", days);
      return days;
    })
    .finally(() => { refreshing = null; });
  return refreshing;
}

export async function GET(request?: Request) {
  const rawDay = request ? new URL(request.url).searchParams.get("day") : null;
  if (rawDay !== null && !/^(0|[1-9]\d*)$/.test(rawDay)) {
    return Response.json({ error: "day" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  const day = rawDay === null ? null : Number(rawDay);
  const respond = (days: ForecastDay[]) => {
    if (day === null) return Response.json(toLegacyGrid(days, Date.now()), { headers });
    const selected = days.find((entry) => entry.day === day);
    return selected ? Response.json(selected, { headers }) :
      Response.json({ error: "day" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  };
  const fresh = cache.getFresh("wind");
  if (fresh) return respond(fresh);

  // Older than 3 h but under 24 h: answer now, refresh in the background.
  const stale = cache.getStale("wind");
  if (stale) {
    after(refresh);
    return respond(stale);
  }

  const days = await refresh();
  if (days) return respond(days);
  return Response.json({ error: "upstream" }, { status: 503, headers: { "Cache-Control": "no-store" } });
}
