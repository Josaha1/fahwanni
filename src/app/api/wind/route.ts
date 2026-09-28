import { after } from "next/server";
import { fetchWindGrid } from "@/lib/wind/client";
import type { WindGrid } from "@/lib/wind/grid";
import { WeatherCache } from "@/lib/weather/cache";

const cache = new WeatherCache<WindGrid>(() => Date.now(), 1, 3 * 60 * 60 * 1000);
const headers = { "Cache-Control": "public, s-maxage=10800, stale-while-revalidate=86400" };
let refreshing: Promise<WindGrid | null> | null = null;

function refresh(): Promise<WindGrid | null> {
  refreshing ??= fetchWindGrid()
    .then((grid) => {
      if (grid) cache.set("wind", grid);
      return grid;
    })
    .finally(() => { refreshing = null; });
  return refreshing;
}

export async function GET() {
  const fresh = cache.getFresh("wind");
  if (fresh) return Response.json(fresh, { headers });

  // Older than 3 h but under 24 h: answer now, refresh in the background.
  const stale = cache.getStale("wind");
  if (stale) {
    after(refresh);
    return Response.json(stale, { headers });
  }

  const grid = await refresh();
  if (grid) return Response.json(grid, { headers });
  return Response.json({ error: "upstream" }, { status: 503, headers: { "Cache-Control": "no-store" } });
}
