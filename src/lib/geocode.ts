import type { Place } from "./place";

type OpenMeteoResult = {
  id: number;
  name: string;
  admin1?: string;
  country?: string;
  country_code?: string;
  latitude: number;
  longitude: number;
};

export function getGeocodeAttempts(q: string, lang: string): { name: string; language: string }[] {
  const attempts = [{ name: q, language: lang }];
  const hasThaiScript = /[\u0E00-\u0E7F]/.test(q);
  if (hasThaiScript && !/^(อำเภอ|เขต|ตำบล)/.test(q)) {
    attempts.push({ name: `อำเภอ${q}`, language: lang });
  }
  if (lang !== "en" || hasThaiScript) attempts.push({ name: q, language: "en" });
  return attempts;
}

export function mapOpenMeteoResults(data: unknown, provinces: Place[], limit = 8, lang = "th"): Place[] {
  if (!data || typeof data !== "object" || !("results" in data) || !Array.isArray(data.results)) return [];
  const remaining = Math.max(0, limit - provinces.length);
  if (remaining === 0) return [];
  const seenCoords = new Set(provinces.map((p) => `${Math.round(p.lat * 10)},${Math.round(p.lon * 10)}`));
  const seenNames = new Set(provinces.flatMap((p) => [p.name, p.admin ?? ""].map((name) => name.trim().toLocaleLowerCase())));
  const results: Place[] = [];

  const ranked = (data.results as OpenMeteoResult[]).filter((item) => item?.country_code === "TH");
  for (const item of ranked) {
    if (!item || typeof item.id !== "number" || typeof item.name !== "string" ||
        !Number.isFinite(item.latitude) || !Number.isFinite(item.longitude)) continue;
    const coord = `${Math.round(item.latitude * 10)},${Math.round(item.longitude * 10)}`;
    const name = item.name.trim().toLocaleLowerCase();
    if (seenCoords.has(coord) || seenNames.has(name)) continue;
    seenCoords.add(coord);
    seenNames.add(name);
    results.push({ id: `open-meteo-${item.id}`, name: item.name,
      admin: lang === "th" ? item.admin1?.replace(/^จังหวัด/, "") : item.admin1,
      country: item.country, lat: item.latitude, lon: item.longitude, source: "search" });
    if (results.length >= remaining) break;
  }
  return results;
}
