import { after } from "next/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import observedData from "../../../../public/data/observed-points.json";
import pointsData from "../../../../public/data/river-points.json";
import { fetchDams } from "@/lib/dams/client";
import { getDamTrend } from "@/lib/dams/trend-source";
import { fetchRiverForecasts } from "@/lib/rivers/client";
import { sumRelease } from "@/lib/rivers/observed";
import { summarizeRiver } from "@/lib/rivers/status";
import type { ObservedPoint, ObservedRelease, RiverGauge, RiverPoint } from "@/lib/rivers/types";
import { WeatherCache } from "@/lib/weather/cache";

const points = pointsData.points as RiverPoint[];
const observed = observedData.points as ObservedPoint[];
const cache = new WeatherCache<RiversPayload>(() => Date.now(), 1, 6 * 60 * 60 * 1000);
const headers = { "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400" };
let refreshing: Promise<RiversPayload | null> | null = null;

type RiversPayload = {
  fetchedAt: string;
  today: string;
  source: string;
  points: Array<Pick<RiverPoint, "id" | "nameTh" | "nameEn" | "river" | "provinceId" | "lat" | "lon" | "downstreamOfDam" | "upstreamDams"> & {
    /** "model" = GloFAS discharge; "observed" = upstream dam release (RID) + last month's HII level, no status. */
    kind: "model" | "observed";
    summary: ReturnType<typeof summarizeRiver>;
    gauge?: RiverGauge;
    release?: ObservedRelease | null;
    /** RID dam ids whose release is summed (observed points only). */
    releaseDams?: string[];
  }>;
};

async function readGauges(): Promise<Record<string, RiverGauge>> {
  try {
    const data = JSON.parse(await readFile(join(process.cwd(), "public/data/hii-gauges.json"), "utf8"));
    return Object.fromEntries(Object.entries(data.gauges ?? {}).map(([id, gauge]) => [id, { ...(gauge as Omit<RiverGauge, "month">), month: data.month }]));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw error;
  }
}

function bangkokToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

function refresh(): Promise<RiversPayload | null> {
  refreshing ??= Promise.all([
    fetchRiverForecasts(), readGauges(), fetchDams().catch(() => null), getDamTrend().catch(() => null),
  ]).then(([forecasts, gauges, dams, trend]) => {
    const today = bangkokToday();
    const byId = new Map((forecasts ?? []).map((forecast) => [forecast.id, forecast]));
    const summaries = points.map((point) => {
      const forecast = byId.get(point.id);
      return forecast ? summarizeRiver(point, forecast, today) : null;
    });
    const releases = observed.map((point) => dams ? sumRelease(point.dams, dams.dams, trend?.trend ?? null) : null);
    // One working source is enough: GloFAS down still leaves RID releases and HII levels.
    if (summaries.every((summary) => summary === null) && releases.every((release) => release === null)) return null;
    const payload: RiversPayload = {
      fetchedAt: new Date().toISOString(), today,
      source: "GloFAS v4 via Open-Meteo Flood API (CC BY 4.0) · RID dam release · HII open data (CC BY-NC)",
      points: [
        ...points.map((point, index) => ({
          id: point.id, nameTh: point.nameTh, nameEn: point.nameEn, river: point.river,
          provinceId: point.provinceId, lat: point.lat, lon: point.lon, kind: "model" as const,
          downstreamOfDam: point.downstreamOfDam, upstreamDams: point.upstreamDams ?? [], summary: summaries[index],
          ...(gauges[point.id] ? { gauge: gauges[point.id] } : {}),
        })),
        ...observed.map((point, index) => ({
          id: point.id, nameTh: point.nameTh, nameEn: point.nameEn, river: point.river,
          provinceId: point.provinceId, lat: point.lat, lon: point.lon, kind: "observed" as const,
          downstreamOfDam: null, upstreamDams: [], summary: null,
          release: releases[index], releaseDams: point.dams,
          ...(gauges[point.id] ? { gauge: gauges[point.id] } : {}),
        })),
      ],
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
