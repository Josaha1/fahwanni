import { expect, it, vi } from "vitest";
import fixture from "./fixture-open-meteo-aq.json";
import { fetchPm25Days, fetchPm25Grid } from "./client";
import { gridPoints } from "@/lib/wind/grid";

it("fetches four parallel chunks with the expected URL and cache options", async () => {
  const points = gridPoints();
  let index = 0;
  const fetchImpl = vi.fn(async (...args: Parameters<typeof fetch>) => {
    const url = new URL(args[0] as string);
    expect(url.origin + url.pathname).toBe("https://air-quality-api.open-meteo.com/v1/air-quality");
    expect(url.searchParams.get("hourly")).toBe("pm2_5");
    expect(url.searchParams.get("forecast_days")).toBe("7");
    expect(url.searchParams.has("forecast_hours")).toBe(false);
    expect(url.searchParams.get("timezone")).toBe("Asia/Bangkok");
    expect(args[1]).toMatchObject({ next: { revalidate: 10800 }, signal: expect.any(AbortSignal) });
    const latitudes = url.searchParams.get("latitude")!.split(",");
    const longitudes = url.searchParams.get("longitude")!.split(",");
    expect(latitudes).toHaveLength(longitudes.length);
    const start = index;
    index += latitudes.length;
    expect(latitudes[0]).toBe(String(points[start].lat));
    expect(longitudes[0]).toBe(String(points[start].lon));
    return Response.json(points.slice(start, index).map((_, i) => fixture[(start + i) % fixture.length]));
  });

  const days = await fetchPm25Days(fetchImpl as typeof fetch);
  expect(fetchImpl).toHaveBeenCalledTimes(4);
  expect(index).toBe(361);
  expect(days).toHaveLength(7);
  expect(days?.[0].pm25[0].slice(0, 3)).toEqual([44.4, 4.1, 6.6]);
  expect(days?.[6].hours).toHaveLength(24);
});

it("returns null on a 429", async () => {
  const fetchImpl = vi.fn(async () => new Response(null, { status: 429 }));
  await expect(fetchPm25Grid(fetchImpl as typeof fetch)).resolves.toBeNull();
  expect(fetchImpl).toHaveBeenCalledTimes(4);
});

it("accepts a single-location object response", async () => {
  let request = 0;
  const fetchImpl = vi.fn(async () => {
    request++;
    if (request === 1) return Response.json(fixture[0]);
    return Response.json(Array.from({ length: 120 }, (_, i) => fixture[(i + request) % fixture.length]));
  });
  // One object plus three arrays must still reach the exact 361-point grid.
  const grid = await fetchPm25Grid(fetchImpl as typeof fetch, Date.parse("2026-09-28T00:00:00+07:00"));
  expect(grid?.pm25[0][0]).toBe(44.4);
  expect(grid?.hours).toHaveLength(24);
});
