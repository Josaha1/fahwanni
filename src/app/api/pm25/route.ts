import { after } from "next/server";
import { fetchPm25Grid } from "@/lib/pm25/client";
import type { Pm25Grid } from "@/lib/pm25/grid";
import { WeatherCache } from "@/lib/weather/cache";

const cache = new WeatherCache<Pm25Grid>(() => Date.now(), 1, 3 * 60 * 60 * 1000);
const headers = { "Cache-Control": "public, s-maxage=10800, stale-while-revalidate=86400" };
let refreshing: Promise<Pm25Grid | null> | null = null;

function refresh(): Promise<Pm25Grid | null> {
  refreshing ??= fetchPm25Grid()
    .then((grid) => {
      if (grid) cache.set("pm25", grid);
      return grid;
    })
    .finally(() => { refreshing = null; });
  return refreshing;
}

export async function GET() {
  const fresh = cache.getFresh("pm25");
  if (fresh) return Response.json(fresh, { headers });

  // Older than 3 h but under 24 h: answer now, refresh in the background.
  const stale = cache.getStale("pm25");
  if (stale) {
    after(refresh);
    return Response.json(stale, { headers });
  }

  const grid = await refresh();
  if (grid) return Response.json(grid, { headers });
  return Response.json({ error: "upstream" }, { status: 503, headers: { "Cache-Control": "no-store" } });
}
