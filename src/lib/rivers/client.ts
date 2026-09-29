import "server-only";

import { z } from "zod";
import pointsData from "../../../public/data/river-points.json";
import type { RiverForecast, RiverPoint } from "./types";

const dailySchema = z.object({
  time: z.array(z.iso.date()),
  river_discharge: z.array(z.number().nonnegative().nullable()),
  river_discharge_median: z.array(z.number().nonnegative().nullable()),
  river_discharge_p25: z.array(z.number().nonnegative().nullable()),
  river_discharge_p75: z.array(z.number().nonnegative().nullable()),
});
const locationSchema = z.object({ daily: dailySchema });

export function riverForecastUrl(points: RiverPoint[]): string {
  const params = new URLSearchParams({
    latitude: points.map((point) => point.snappedLat).join(","),
    longitude: points.map((point) => point.snappedLon).join(","),
    daily: "river_discharge,river_discharge_median,river_discharge_p25,river_discharge_p75",
    past_days: "7",
    forecast_days: "16",
  });
  return `https://flood-api.open-meteo.com/v1/flood?${params}`;
}

/** Open-Meteo returns locations in request order, or an object for one location. */
export function parseFlood(raw: unknown, points: RiverPoint[]): RiverForecast[] {
  const parsed = z.array(locationSchema).safeParse(Array.isArray(raw) ? raw : [raw]);
  if (!parsed.success || parsed.data.length !== points.length) return [];
  if (parsed.data.some(({ daily }) => {
    const count = daily.time.length;
    return !count || [daily.river_discharge, daily.river_discharge_median, daily.river_discharge_p25,
      daily.river_discharge_p75].some((values) => values.length !== count);
  })) return [];

  return parsed.data.map(({ daily }, index) => ({
    id: points[index].id,
    days: daily.time.flatMap((date, day) => {
      const value = daily.river_discharge[day];
      return value === null ? [] : [{ date, value, median: daily.river_discharge_median[day],
        p25: daily.river_discharge_p25[day], p75: daily.river_discharge_p75[day] }];
    }),
  }));
}

/** Returns null on an upstream or response failure; the route can serve stale data. */
export async function fetchRiverForecasts(fetchImpl: typeof fetch = fetch): Promise<RiverForecast[] | null> {
  const points = pointsData.points as RiverPoint[];
  try {
    const response = await fetchImpl(riverForecastUrl(points), {
      next: { revalidate: 21600 }, signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) return null;
    const forecasts = parseFlood(await response.json(), points);
    return forecasts.length === points.length && forecasts.some((forecast) => forecast.days.length) ? forecasts : null;
  } catch {
    return null;
  }
}
