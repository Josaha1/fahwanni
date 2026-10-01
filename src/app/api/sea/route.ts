import { DIVE_SPOTS, erddapUrl, inThaiSeas, nearestSeaReading, type SeaReading } from "@/lib/sea";

/** NOAA Coral Reef Watch (SST + bleaching heat stress) for a point or all dive spots; daily data, cached 12 h. */
const HALF_DAY = 12 * 60 * 60 * 1000;
const cache = new Map<string, { at: number; reading: SeaReading | null }>();
const headers = { "Cache-Control": "public, s-maxage=43200, stale-while-revalidate=172800" };

async function reading(lat: number, lon: number): Promise<SeaReading | null> {
  const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < HALF_DAY) return hit.reading;
  try {
    const response = await fetch(erddapUrl(lat, lon), { next: { revalidate: 43200 }, signal: AbortSignal.timeout(25_000) });
    if (!response.ok) throw new Error(String(response.status));
    const value = nearestSeaReading(await response.json(), lat, lon);
    cache.set(key, { at: Date.now(), reading: value });
    if (cache.size > 300) cache.delete(cache.keys().next().value!);
    return value;
  } catch (error) {
    if (hit) return hit.reading;
    throw error;
  }
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  try {
    if (params.get("spots") === "1") {
      const results = await Promise.allSettled(DIVE_SPOTS.map((spot) => reading(spot.lat, spot.lon)));
      const spots = DIVE_SPOTS.map((spot, i) => ({ ...spot, reading: results[i].status === "fulfilled" ? results[i].value : null }));
      if (spots.every((spot) => !spot.reading)) throw new Error("all failed");
      return Response.json({ spots, source: "NOAA Coral Reef Watch" }, { headers });
    }
    const lat = Number(params.get("lat")), lon = Number(params.get("lon"));
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !inThaiSeas(lat, lon)) return Response.json({ reading: null }, { headers });
    return Response.json({ reading: await reading(lat, lon), source: "NOAA Coral Reef Watch" }, { headers });
  } catch {
    return Response.json({ error: "upstream" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
