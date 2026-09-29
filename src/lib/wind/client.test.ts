import { expect, it, vi } from "vitest";
import { fetchWindDays, fetchWindGrid } from "./client";
import fixture from "./fixture-open-meteo.json";

it("returns null on a 429 without caching the error", async () => {
  const fetchImpl = vi.fn(async (...args: Parameters<typeof fetch>) => {
    const url = new URL(args[0] as string);
    expect(url.searchParams.get("hourly")?.split(",")).toEqual([
      "wind_speed_10m", "wind_direction_10m", "precipitation", "precipitation_probability",
      "temperature_2m", "apparent_temperature", "cloud_cover",
    ]);
    expect(url.searchParams.get("forecast_days")).toBe("7");
    expect(url.searchParams.has("forecast_hours")).toBe(false);
    expect(url.searchParams.get("timezone")).toBe("Asia/Bangkok");
    expect(url.searchParams.get("wind_speed_unit")).toBe("kmh");
    expect(args[1]).toMatchObject({ next: { revalidate: 10800 }, signal: expect.any(AbortSignal) });
    expect(args[1]).not.toHaveProperty("cache", "no-store");
    return new Response(null, { status: 429 });
  });

  await expect(fetchWindGrid(fetchImpl as typeof fetch)).resolves.toBeNull();
  expect(fetchImpl).toHaveBeenCalled();
});

it("fetches five chunks and keeps each upstream response below 2 MB", async () => {
  const sizes: number[] = [];
  const fetchImpl = vi.fn(async (input: string | URL | Request) => {
    const url = new URL(input.toString());
    const count = url.searchParams.get("latitude")!.split(",").length;
    const body = Array.from({ length: count }, (_, index) => fixture[index % fixture.length]);
    const json = JSON.stringify(body);
    sizes.push(Buffer.byteLength(json));
    return new Response(json);
  });
  const days = await fetchWindDays(fetchImpl as typeof fetch);
  expect(fetchImpl).toHaveBeenCalledTimes(5);
  expect(Math.max(...sizes)).toBeLessThan(2_000_000);
  expect(days).toHaveLength(7);
  const grid = await fetchWindGrid(fetchImpl as typeof fetch, Date.parse("2026-09-28T00:00:00+07:00"));
  expect(grid?.hours).toHaveLength(8);
  expect(grid?.precipHours).toHaveLength(12);
  expect(grid?.tempHours).toHaveLength(24);
});
