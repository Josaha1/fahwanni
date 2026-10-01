import { after } from "next/server";
import { fetchDams } from "@/lib/dams/client";
import { fetchDwr, type DwrPayload } from "@/lib/dams/dwr-client";
import { WeatherCache } from "@/lib/weather/cache";

/** Medium and small reservoirs from DWR, without places already covered by RID's 35 large dams (/api/dams). */
const cache = new WeatherCache<DwrPayload>(() => Date.now(), 1, 6 * 60 * 60 * 1000);
const headers = { "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400" };
let refreshing: Promise<DwrPayload | null> | null = null;

function refresh(): Promise<DwrPayload | null> {
  refreshing ??= fetchDams().catch(() => null)
    .then((rid) => fetchDwr(rid?.dams ?? []))
    .then((payload) => {
      if (payload) cache.set("dams-all", payload);
      return payload;
    }).finally(() => { refreshing = null; });
  return refreshing;
}

export async function GET() {
  const fresh = cache.getFresh("dams-all");
  if (fresh) return Response.json(fresh, { headers });
  const stale = cache.getStale("dams-all");
  if (stale) {
    after(refresh);
    return Response.json(stale, { headers });
  }
  const payload = await refresh();
  if (payload) return Response.json(payload, { headers });
  return Response.json({ error: "upstream" }, { status: 503, headers: { "Cache-Control": "no-store" } });
}
