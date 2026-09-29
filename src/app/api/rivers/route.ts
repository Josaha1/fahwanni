import { after } from "next/server";
import pointsData from "../../../../public/data/river-points.json";
import { fetchRiverForecasts } from "@/lib/rivers/client";
import { summarizeRiver } from "@/lib/rivers/status";
import type { RiverPoint } from "@/lib/rivers/types";
import { WeatherCache } from "@/lib/weather/cache";

const points = pointsData.points as RiverPoint[];
const cache = new WeatherCache<RiversPayload>(() => Date.now(), 1, 6 * 60 * 60 * 1000);
const headers = { "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400" };
let refreshing: Promise<RiversPayload | null> | null = null;

type RiversPayload = {
  fetchedAt: string;
  today: string;
  source: string;
  points: Array<Pick<RiverPoint, "id" | "nameTh" | "nameEn" | "river" | "provinceId" | "lat" | "lon" | "downstreamOfDam" | "upstreamDams"> & {
    summary: ReturnType<typeof summarizeRiver>;
  }>;
};

function bangkokToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

function refresh(): Promise<RiversPayload | null> {
  refreshing ??= fetchRiverForecasts().then((forecasts) => {
    if (!forecasts) return null;
    const today = bangkokToday();
    const byId = new Map(forecasts.map((forecast) => [forecast.id, forecast]));
    const summaries = points.map((point) => {
      const forecast = byId.get(point.id);
      return forecast ? summarizeRiver(point, forecast, today) : null;
    });
    if (summaries.every((summary) => summary === null)) return null;
    const payload: RiversPayload = {
      fetchedAt: new Date().toISOString(), today,
      source: "GloFAS v4 via Open-Meteo Flood API (CC BY 4.0)",
      points: points.map((point, index) => ({
        id: point.id, nameTh: point.nameTh, nameEn: point.nameEn, river: point.river,
        provinceId: point.provinceId, lat: point.lat, lon: point.lon,
        downstreamOfDam: point.downstreamOfDam, upstreamDams: point.upstreamDams ?? [], summary: summaries[index],
      })),
    };
    cache.set(today, payload);
    return payload;
  }).finally(() => { refreshing = null; });
  return refreshing;
}

export async function GET() {
  const today = bangkokToday();
  const fresh = cache.getFresh(today);
  if (fresh) return Response.json(fresh, { headers });
  const stale = cache.getStale(today);
  if (stale) {
    after(refresh);
    return Response.json(stale, { headers });
  }
  const payload = await refresh();
  if (payload) return Response.json(payload, { headers });
  return Response.json({ error: "upstream" }, { status: 503, headers: { "Cache-Control": "no-store" } });
}
