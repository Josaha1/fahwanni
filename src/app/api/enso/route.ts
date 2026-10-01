import { ensoStatus, parseOni, type EnsoStatus } from "@/lib/enso";

/** NOAA CPC Oceanic Niño Index (public domain), updated monthly; cached a day, last good answer kept on failure. */
const URL = "https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt";
const DAY = 24 * 60 * 60 * 1000;
let cached: { at: number; status: EnsoStatus } | null = null;
const headers = { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" };

export async function GET() {
  if (cached && Date.now() - cached.at < DAY) return Response.json(cached.status, { headers });
  try {
    const response = await fetch(URL, { next: { revalidate: 86400 }, signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new Error(String(response.status));
    const status = ensoStatus(parseOni(await response.text()));
    if (!status) throw new Error("empty");
    cached = { at: Date.now(), status };
    return Response.json(status, { headers });
  } catch {
    if (cached) return Response.json(cached.status, { headers: { "Cache-Control": "public, s-maxage=3600" } });
    return Response.json({ error: "upstream" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
