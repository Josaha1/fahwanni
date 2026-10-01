import { parseRiskBbox, parseRiskFeatures, type FloodRiskPoint } from "@/lib/water/flood-risk";

/** Viewport proxy to DDPM floodrisk_rg (catalog.disaster.go.th, CC BY); levels 2–4 only, cached per snapped box. */
const SERVICE = "https://gis-portal.disaster.go.th/arcgis/rest/services/floodrisk_rg/FeatureServer/0/query";
const DAY = 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 300;
const cache = new Map<string, { at: number; points: FloodRiskPoint[] }>();
const headers = { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" };

export async function GET(request: Request) {
  const box = parseRiskBbox(new URL(request.url).searchParams.get("bbox"));
  if (!box) return Response.json({ error: "bad_bbox" }, { status: 400 });
  const key = box.join(",");
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < DAY) return Response.json({ bbox: box, points: hit.points }, { headers });
  const query = new URLSearchParams({
    where: "risk_level >= 2", geometry: key, geometryType: "esriGeometryEnvelope", inSR: "4326", spatialRel: "esriSpatialRelIntersects",
    outFields: "village_co,mname,tname,aname,pname,risk_level", outSR: "4326", resultRecordCount: "2000", f: "geojson",
  });
  try {
    const response = await fetch(`${SERVICE}?${query}`, { next: { revalidate: 86400 }, signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new Error(String(response.status));
    const points = parseRiskFeatures(await response.json());
    cache.delete(key);
    cache.set(key, { at: Date.now(), points });
    if (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value!);
    return Response.json({ bbox: box, points }, { headers });
  } catch {
    // The DDPM host is sometimes unreachable: an older answer beats none.
    if (hit) return Response.json({ bbox: box, points: hit.points, stale: true }, { headers: { "Cache-Control": "public, s-maxage=300" } });
    return Response.json({ error: "upstream" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
