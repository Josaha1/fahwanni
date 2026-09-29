import { after } from "next/server";
import { fetchPm25Days } from "@/lib/pm25/client";
import { toLegacyPm25Grid, type Pm25Day } from "@/lib/pm25/days";
import { WeatherCache } from "@/lib/weather/cache";

const cache = new WeatherCache<Pm25Day[]>(() => Date.now(), 1, 3 * 60 * 60 * 1000);
const headers = { "Cache-Control": "public, s-maxage=10800, stale-while-revalidate=86400" };
let refreshing: Promise<Pm25Day[] | null> | null = null;

function refresh(): Promise<Pm25Day[] | null> {
  refreshing ??= fetchPm25Days()
    .then((days) => {
      if (days) cache.set("pm25", days);
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
  const respond = (days: Pm25Day[]) => {
    if (day === null) return Response.json(toLegacyPm25Grid(days, Date.now()), { headers });
    const selected = days.find((entry) => entry.day === day);
    return selected ? Response.json(selected, { headers }) :
      Response.json({ error: "day" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  };
  const fresh = cache.getFresh("pm25");
  if (fresh) return respond(fresh);

  // Older than 3 h but under 24 h: answer now, refresh in the background.
  const stale = cache.getStale("pm25");
  if (stale) {
    after(refresh);
    return respond(stale);
  }

  const days = await refresh();
  if (days) return respond(days);
  return Response.json({ error: "upstream" }, { status: 503, headers: { "Cache-Control": "no-store" } });
}
