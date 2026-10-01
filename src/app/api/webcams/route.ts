import { parseWebcams, webcamsUrl, type Webcam } from "@/lib/webcams";

/** Nearby live webcams (Windy). Without WINDY_WEBCAMS_KEY the feature is off (204). Lists live ≤ 5 min: image URLs expire in ~10. */
const FIVE_MIN = 5 * 60 * 1000;
const cache = new Map<string, { at: number; webcams: Webcam[] }>();

export async function GET(request: Request) {
  const key = process.env.WINDY_WEBCAMS_KEY;
  if (!key) return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  const params = new URL(request.url).searchParams;
  const lat = Number(params.get("lat")), lon = Number(params.get("lon"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return Response.json({ error: "bad_request" }, { status: 400 });
  const cacheKey = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  const hit = cache.get(cacheKey);
  const headers = { "Cache-Control": "private, max-age=300" };
  if (hit && Date.now() - hit.at < FIVE_MIN) return Response.json({ webcams: hit.webcams }, { headers });
  try {
    const response = await fetch(webcamsUrl(lat, lon), { headers: { "x-windy-api-key": key }, cache: "no-store", signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error(String(response.status));
    const webcams = parseWebcams(await response.json());
    cache.set(cacheKey, { at: Date.now(), webcams });
    if (cache.size > 200) cache.delete(cache.keys().next().value!);
    return Response.json({ webcams }, { headers });
  } catch {
    return Response.json({ error: "upstream" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
