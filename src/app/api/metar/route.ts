import airportsData from "../../../../public/data/th-airports.json";
import { parseMetar, type AirportObservation } from "@/lib/metar";

/** Proxy to aviationweather.gov (NOAA/NWS, public domain; no CORS, 100 req/min) for up to 4 Thai airports; 10 min cache. */
const KNOWN = new Set(airportsData.airports.map((airport) => airport.icao));
const TEN_MIN = 10 * 60 * 1000;
const cache = new Map<string, { at: number; items: AirportObservation[] }>();
const headers = { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1800" };

export async function GET(request: Request) {
  const ids = [...new Set((new URL(request.url).searchParams.get("ids") ?? "").toUpperCase().split(",").filter((id) => KNOWN.has(id)))].sort().slice(0, 4);
  if (!ids.length) return Response.json({ error: "bad_ids" }, { status: 400 });
  const key = ids.join(",");
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TEN_MIN) return Response.json({ items: hit.items }, { headers });
  try {
    const response = await fetch(`https://aviationweather.gov/api/data/metar?ids=${key}&format=json`, {
      headers: { "User-Agent": "fahwanni/1.0 (https://fahwanni.vercel.app)" }, next: { revalidate: 600 }, signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok && response.status !== 204) throw new Error(String(response.status));
    const raw = response.status === 204 ? [] : await response.json() as unknown[];
    const items = (Array.isArray(raw) ? raw : []).flatMap((item) => { const obs = parseMetar(item as never); return obs ? [obs] : []; });
    cache.set(key, { at: Date.now(), items });
    if (cache.size > 200) cache.delete(cache.keys().next().value!);
    return Response.json({ items }, { headers });
  } catch {
    if (hit) return Response.json({ items: hit.items, stale: true }, { headers: { "Cache-Control": "public, s-maxage=120" } });
    return Response.json({ error: "upstream" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
