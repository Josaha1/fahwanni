import { afterEach, expect, it, vi } from "vitest";
import fixture from "@/lib/rain-risk/fixture-tmd-today.json";
import { GET } from "./route";

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

it("returns TMD stations and caches the response for 30 minutes", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
  const fetchMock = vi.fn(async () => Response.json(fixture));
  vi.stubGlobal("fetch", fetchMock);
  const first = await GET();
  expect((await first.json()).stations).toHaveLength(6);
  expect(first.headers.get("Cache-Control")).toBe("public, s-maxage=1800, stale-while-revalidate=3600");
  expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("WeatherToday/V2/"), expect.objectContaining({ next: { revalidate: 1800 } }));
  vi.setSystemTime(30 * 60 * 1000 - 1);
  await GET();
  expect(fetchMock).toHaveBeenCalledOnce();
  vi.setSystemTime(30 * 60 * 1000);
  await GET();
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

it("serves stale data after an upstream failure", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(60 * 60 * 1000);
  vi.stubGlobal("fetch", vi.fn(async () => Response.json(fixture)));
  await GET();
  vi.setSystemTime(91 * 60 * 1000);
  vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
  const response = await GET();
  expect(response.status).toBe(200);
  expect((await response.json()).reporting).toBe(124);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
});

it("returns 503 if the upstream fails before any valid report", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(25 * 60 * 60 * 1000);
  vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
  const response = await GET();
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ error: "upstream" });
});
