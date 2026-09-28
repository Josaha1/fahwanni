import { afterEach, expect, it, vi } from "vitest";
import { GET } from "./route";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it("returns parsed warnings and caches the response for 15 minutes", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
  const fetchMock = vi.fn(async () => new Response("<WeatherForecastDaily><Warnings><Warning><title>Alert</title><description>Rain</description></Warning></Warnings></WeatherForecastDaily>"));
  vi.stubGlobal("fetch", fetchMock);

  const first = await GET();
  expect(await first.json()).toEqual({ items: [{ title: "Alert", description: "Rain" }] });
  expect(first.headers.get("Cache-Control")).toBe("public, s-maxage=900, stale-while-revalidate=1800");
  expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("WeatherWarningNews/v2/"), expect.objectContaining({ next: { revalidate: 900 } }));
  vi.setSystemTime(15 * 60 * 1000 - 1);
  await GET();
  expect(fetchMock).toHaveBeenCalledOnce();
  vi.setSystemTime(15 * 60 * 1000);
  await GET();
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

it("returns the last good warnings when the upstream fails", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(30 * 60 * 1000);
  vi.stubGlobal("fetch", vi.fn(async () => new Response("<Warnings><Warning><title>Alert</title><description>Rain</description></Warning></Warnings>")));
  await GET();
  vi.setSystemTime(46 * 60 * 1000);
  vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
  const response = await GET();
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ items: [{ title: "Alert", description: "Rain" }] });
  expect(response.headers.get("Cache-Control")).toBe("no-store");
});
