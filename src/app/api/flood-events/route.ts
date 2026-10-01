import { after } from "next/server";
import { FLOOD_EVENT_DAYS, mergeFloodEvents, parseGdacsFloods, parseGlide, type FloodEvent } from "@/lib/water/flood-events";
import { WeatherCache } from "@/lib/weather/cache";

type Payload = { fetchedAt: string; days: number; sources: string[]; items: FloodEvent[] };

const GLIDE_URL = "https://data.humdata.org/dataset/03d3786f-36a9-4df4-887f-de5f196b7d9b/resource/10672278-9fdc-45eb-ab06-8780d3088105/download/tha_glide_events.geojson";
const cache = new WeatherCache<Payload>(() => Date.now(), 1, 30 * 60 * 1000);
const headers = { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=21600" };
let refreshing: Promise<Payload | null> | null = null;

function gdacsUrl(nowMs: number) {
  const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  return `https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?eventlist=FL&country=Thailand&fromDate=${day(nowMs - FLOOD_EVENT_DAYS * 86_400_000)}&toDate=${day(nowMs + 86_400_000)}`;
}

async function getJson(url: string): Promise<unknown> {
  const response = await fetch(url, { next: { revalidate: 1800 }, signal: AbortSignal.timeout(20_000), headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`${response.status}`);
  // GDACS answers 204 No Content when there are no events in the window: that is "none", not a failure.
  if (response.status === 204) return { type: "FeatureCollection", features: [] };
  return response.json();
}

function refresh(): Promise<Payload | null> {
  refreshing ??= (async () => {
    const nowMs = Date.now();
    const [gdacs, glide] = await Promise.allSettled([getJson(gdacsUrl(nowMs)), getJson(GLIDE_URL)]);
    // One source is enough; both failing keeps the cache.
    if (gdacs.status === "rejected" && glide.status === "rejected") return null;
    const items = mergeFloodEvents(
      gdacs.status === "fulfilled" ? parseGdacsFloods(gdacs.value as never, nowMs) : [],
      glide.status === "fulfilled" ? parseGlide(glide.value as never, nowMs) : [],
    );
    const sources = [
      ...(gdacs.status === "fulfilled" ? ["GDACS (European Commission JRC / UN OCHA)"] : []),
      ...(glide.status === "fulfilled" ? ["ADRC GLIDE via HDX (CC BY-IGO)"] : []),
    ];
    const payload = { fetchedAt: new Date(nowMs).toISOString(), days: FLOOD_EVENT_DAYS, sources, items };
    cache.set("flood-events", payload);
    return payload;
  })().finally(() => { refreshing = null; });
  return refreshing;
}

export async function GET() {
  const fresh = cache.getFresh("flood-events");
  if (fresh) return Response.json(fresh, { headers });
  const stale = cache.getStale("flood-events");
  if (stale) {
    after(refresh);
    return Response.json(stale, { headers });
  }
  const payload = await refresh();
  if (payload) return Response.json(payload, { headers });
  return Response.json({ error: "upstream" }, { status: 503, headers: { "Cache-Control": "no-store" } });
}
