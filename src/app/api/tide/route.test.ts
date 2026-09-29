import { afterEach, expect, it, vi } from "vitest";

const scheduled = vi.hoisted(() => [] as Array<() => unknown>);
vi.mock("next/server", () => ({ after: (task: () => unknown) => { scheduled.push(task); } }));

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); vi.resetModules(); scheduled.length = 0; });

const upstream = { hourly: { time: ["2026-09-29T05:00", "2026-09-29T06:00", "2026-09-29T07:00"], sea_level_height_msl: [1.5, 1.96, 1.5] } };
async function loadRoute() { return (await import("./route")).GET; }

it("fetches Open-Meteo Marine with a three-hour cache and a 15-second timeout", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-29T00:00:00Z"));
  const fetchMock = vi.fn<typeof fetch>(async () => Response.json(upstream));
  vi.stubGlobal("fetch", fetchMock);
  const GET = await loadRoute();
  const response = await GET();
  expect(response.headers.get("Cache-Control")).toBe("public, s-maxage=10800, stale-while-revalidate=86400");
  expect(await response.json()).toEqual({ times: ["2026-09-28T22:00:00.000Z", "2026-09-28T23:00:00.000Z", "2026-09-29T00:00:00.000Z"], heights: [1.5, 1.96, 1.5] });
  expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("marine-api.open-meteo.com/v1/marine?latitude=13.5&longitude=100.6"),
    expect.objectContaining({ next: { revalidate: 10800 }, signal: expect.any(AbortSignal) }));
  vi.setSystemTime(new Date("2026-09-29T02:59:00Z"));
  await GET();
  expect(fetchMock).toHaveBeenCalledOnce();
});

it("serves stale data during refresh and keeps it after upstream failure", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-29T00:00:00Z"));
  const fetchMock = vi.fn().mockResolvedValueOnce(Response.json(upstream)).mockResolvedValueOnce(new Response(null, { status: 503 }));
  vi.stubGlobal("fetch", fetchMock);
  const GET = await loadRoute();
  const original = await (await GET()).json();
  vi.setSystemTime(new Date("2026-09-29T03:00:00Z"));
  expect(await (await GET()).json()).toEqual(original);
  expect(scheduled).toHaveLength(1);
  await scheduled[0]();
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(await (await GET()).json()).toEqual(original);
});

it("returns 503 without a usable series", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ hourly: { time: [], sea_level_height_msl: [] } })));
  const response = await (await loadRoute())();
  expect(response.status).toBe(503);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
});
