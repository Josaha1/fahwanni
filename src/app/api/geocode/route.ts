import { getGeocodeAttempts, mapOpenMeteoResults } from "@/lib/geocode";
import { searchProvinces } from "@/lib/provinces";

const headers = { "Cache-Control": "public, s-maxage=86400" };

async function searchOpenMeteo(q: string, lang: string): Promise<unknown> {
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.search = new URLSearchParams({ name: q, count: "8", language: lang, format: "json" }).toString();
  const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`Open-Meteo ${response.status}`);
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

  try {
    let data: unknown;
    for (const attempt of getGeocodeAttempts(q, lang)) {
      data = await searchOpenMeteo(attempt.name, attempt.language);
      if (data && typeof data === "object" && "results" in data &&
          Array.isArray(data.results) && data.results.length > 0) break;
    }
    return Response.json({ results: [...provinces, ...mapOpenMeteoResults(data, provinces, 8, lang)] }, { headers });
  } catch {
    return Response.json({ results: provinces }, { headers });
  }
}
