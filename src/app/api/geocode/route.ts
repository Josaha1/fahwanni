import { getGeocodeAttempts, mapOpenMeteoResults } from "@/lib/geocode";
import { geocodeBreakerUntil, geocodeCacheAge, geocodeFallback, geocodeKey, type GeocodeEntry } from "@/lib/geocode-guard";
import { searchProvinces } from "@/lib/provinces";

const headers = { "Cache-Control": "public, s-maxage=86400" };
const cache = new Map<string, GeocodeEntry>();
let breakerUntil = 0;

class GeocodeUpstreamError extends Error {
  constructor(readonly status: number, readonly retryAfter: string | null) {
    super(`Open-Meteo ${status}`);
  }
}

async function searchOpenMeteo(q: string, lang: string): Promise<unknown> {
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.search = new URLSearchParams({ name: q, count: "8", language: lang, format: "json" }).toString();
  const response = await fetch(url, { next: { revalidate: 86400 }, signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new GeocodeUpstreamError(response.status, response.headers?.get("Retry-After") ?? null);
  return response.json();
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const q = params.get("q")?.trim() ?? "";
  const lang = params.get("lang") ?? "th";
  if (q.length < 1 || q.length > 80) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  const provinces = searchProvinces(q).map((province) => ({
    ...province, country: lang === "th" ? "ไทย" : "Thailand",
  }));
  if (provinces.length === 8) return Response.json({ results: provinces }, { headers });

  const key = geocodeKey(q, lang);
  const now = Date.now();
  const entry = cache.get(key);
  const age = geocodeCacheAge(entry, now);
  if (age === "expired") cache.delete(key);
  else if (entry) {
    cache.delete(key);
    cache.set(key, entry);
  }
  if (now < breakerUntil) {
    const fallback = geocodeFallback(age === "expired" ? undefined : entry, provinces, now);
    return Response.json({ results: fallback.results }, { headers: fallback.headers });
  }
  if (age === "fresh") return Response.json({ results: entry!.results }, { headers });

  try {
    let data: unknown;
    for (const attempt of getGeocodeAttempts(q, lang)) {
      data = await searchOpenMeteo(attempt.name, attempt.language);
      if (data && typeof data === "object" && "results" in data &&
          Array.isArray(data.results) && data.results.length > 0) break;
    }
    const results = [...provinces, ...mapOpenMeteoResults(data, provinces, 8, lang)];
    cache.delete(key);
    cache.set(key, { results, storedAt: Date.now() });
    if (cache.size > 500) cache.delete(cache.keys().next().value!);
    return Response.json({ results }, { headers });
  } catch (error) {
    const until = geocodeBreakerUntil(error instanceof GeocodeUpstreamError ? error.status : null,
      error instanceof GeocodeUpstreamError ? error.retryAfter : null, Date.now());
    if (until !== null) breakerUntil = Math.max(breakerUntil, until);
    const fallback = geocodeFallback(age === "expired" ? undefined : entry, provinces, Date.now());
    return Response.json({ results: fallback.results }, { headers: fallback.headers });
  }
}
