import { expect, it, vi } from "vitest";
import pointsData from "../../../public/data/river-points.json";
import fixture from "./fixture-flood.json";
import { fetchRiverForecasts, parseFlood, riverForecastUrl } from "./client";
import type { RiverPoint } from "./types";

const points = pointsData.points as RiverPoint[];

it("parses all real Flood API locations in point order", () => {
  const forecasts = parseFlood(fixture, points);
  expect(forecasts).toHaveLength(16);
  for (const [index, forecast] of forecasts.entries()) {
    expect(forecast.id).toBe(points[index].id);
    expect(forecast.days).toHaveLength(23);
    expect(forecast.days[0]).toEqual({
      date: fixture[index].daily.time[0],
      value: fixture[index].daily.river_discharge[0],
      median: fixture[index].daily.river_discharge_median[0],
      p25: fixture[index].daily.river_discharge_p25[0],
      p75: fixture[index].daily.river_discharge_p75[0],
    });
  }
});

it("accepts a single location and skips null discharge without shifting forecast bands", () => {
  const raw = structuredClone(fixture[0]);
  raw.daily.river_discharge[1] = null as unknown as number;
  raw.daily.river_discharge_median[2] = null as unknown as number;
  const [forecast] = parseFlood(raw, points.slice(0, 1));
  expect(forecast.days).toHaveLength(22);
  expect(forecast.days[1]).toEqual({
    date: raw.daily.time[2], value: raw.daily.river_discharge[2], median: null,
    p25: raw.daily.river_discharge_p25[2], p75: raw.daily.river_discharge_p75[2],
  });
});

it("rejects malformed arrays and mismatched location counts", () => {
  const malformed = structuredClone(fixture);
  malformed[0].daily.river_discharge_p75.pop();
  expect(parseFlood(malformed, points)).toEqual([]);
  expect(parseFlood(fixture.slice(1), points)).toEqual([]);
  expect(parseFlood({ error: true }, points.slice(0, 1))).toEqual([]);
});

it("uses snapped coordinates and requested daily fields in one request", async () => {
  const url = new URL(riverForecastUrl(points));
  expect(url.origin).toBe("https://flood-api.open-meteo.com");
  expect(url.searchParams.get("latitude")?.split(",")).toEqual(points.map((point) => String(point.snappedLat)));
  expect(url.searchParams.get("longitude")?.split(",")).toEqual(points.map((point) => String(point.snappedLon)));
  expect(url.searchParams.get("daily")).toBe("river_discharge,river_discharge_median,river_discharge_p25,river_discharge_p75");
  expect(url.searchParams.get("past_days")).toBe("7");
  expect(url.searchParams.get("forecast_days")).toBe("16");

  const fetchImpl = vi.fn(async () => new Response(JSON.stringify(fixture)));
  const forecasts = await fetchRiverForecasts(fetchImpl as typeof fetch);
  expect(forecasts).toHaveLength(16);
  expect(fetchImpl).toHaveBeenCalledOnce();
  expect(fetchImpl).toHaveBeenCalledWith(url.toString(), {
    next: { revalidate: 21600 }, signal: expect.any(AbortSignal),
  });
});

it("returns null on upstream errors or unusable data", async () => {
  expect(await fetchRiverForecasts(vi.fn(async () => new Response(null, { status: 429 })) as typeof fetch)).toBeNull();
  expect(await fetchRiverForecasts(vi.fn(async () => { throw new Error("timeout"); }) as typeof fetch)).toBeNull();
  expect(await fetchRiverForecasts(vi.fn(async () => new Response(JSON.stringify({ error: true }))) as typeof fetch)).toBeNull();
});
