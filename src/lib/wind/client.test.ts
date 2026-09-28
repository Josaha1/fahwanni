import { expect, it, vi } from "vitest";
import { fetchWindGrid } from "./client";

it("returns null on a 429 without caching the error", async () => {
  const fetchImpl = vi.fn(async (...args: Parameters<typeof fetch>) => {
    const url = new URL(args[0] as string);
    expect(url.searchParams.get("hourly")?.split(",")).toEqual([
      "wind_speed_10m", "wind_direction_10m", "precipitation", "precipitation_probability",
      "temperature_2m", "apparent_temperature",
    ]);
    expect(url.searchParams.get("forecast_hours")).toBe("24");
    expect(url.searchParams.get("timezone")).toBe("UTC");
    expect(args[1]).toMatchObject({ next: { revalidate: 10800 }, signal: expect.any(AbortSignal) });
    expect(args[1]).not.toHaveProperty("cache", "no-store");
    return new Response(null, { status: 429 });
  });

  await expect(fetchWindGrid(fetchImpl as typeof fetch)).resolves.toBeNull();
  expect(fetchImpl).toHaveBeenCalled();
});
