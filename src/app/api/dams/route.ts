import { after } from "next/server";
import { fetchDams, type DamsPayload } from "@/lib/dams/client";
import { WeatherCache } from "@/lib/weather/cache";

const cache = new WeatherCache<DamsPayload>(() => Date.now(), 1, 60 * 60 * 1000);
const headers = { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" };
let refreshing: Promise<DamsPayload | null> | null = null;

function refresh(): Promise<DamsPayload | null> {
  refreshing ??= fetchDams()
    .then((payload) => {
      if (payload) cache.set("dams", payload);
      return payload;
    })
    .finally(() => { refreshing = null; });
  return refreshing;
}

export async function GET() {
  const fresh = cache.getFresh("dams");
  if (fresh) return Response.json(fresh, { headers });

  const stale = cache.getStale("dams");
  if (stale) {
    after(refresh);
    return Response.json(stale, { headers });
  }

  const payload = await refresh();
  if (payload) return Response.json(payload, { headers });
  return Response.json({ error: "upstream" }, { status: 503, headers: { "Cache-Control": "no-store" } });
}
