import { parseLatLon } from "@/lib/geo";
import { getFloodSnapshot } from "@/lib/flood/source";
import { nationalSamples, nearMe } from "@/lib/flood/viirs";

const headers = { "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400" };

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const hasPlace = params.has("lat") || params.has("lon");
  const place = hasPlace ? parseLatLon(params.get("lat"), params.get("lon")) : null;
  if (hasPlace && !place) return Response.json({ error: "bad_coordinates" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  const { snapshot, stale } = await getFloodSnapshot();
  if (!snapshot) return Response.json({ error: "upstream" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  return Response.json({ ...snapshot.payload, stale: !!stale,
    ...(place ? { nearMe: nearMe(snapshot.samples, place) } : {}),
    ...(params.get("scope") === "th" || params.get("samples") === "th" ? nationalSamples(snapshot.samples) : {}),
  }, { headers: stale ? { "Cache-Control": "public, s-maxage=300" } : headers });
}
