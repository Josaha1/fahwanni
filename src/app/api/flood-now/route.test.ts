import { readFileSync } from "node:fs";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { thailandTiles } from "@/lib/flood/viirs";

const scheduled = vi.hoisted(() => [] as Array<() => unknown>);
const maskMode = vi.hoisted(() => ({ real: false }));
vi.mock("next/server", () => ({ after: (task: () => unknown) => { scheduled.push(task); } }));
vi.mock("@/lib/flood/mask", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/flood/mask")>();
  return { ...actual, prepareProvinceMask: (data: Parameters<typeof actual.prepareProvinceMask>[0]) => maskMode.real
    ? actual.prepareProvinceMask(data)
    : [{ id: "bangkok", bbox: [100.5, 13.7, 100.55, 13.75],
      polygons: [[[[100.5, 13.7], [100.55, 13.7], [100.55, 13.75], [100.5, 13.75], [100.5, 13.7]]]] }] };
});
const fixture = readFileSync("src/lib/flood/fixture-flood-tile.png");
const request = (query = "") => new Request(`http://x/api/flood-now${query}`);
const tileResponse = () => new Response(new Uint8Array(fixture), { headers: { "Content-Type": "image/png" } });

beforeEach(() => { maskMode.real = false; });

afterEach(() => {
  vi.unstubAllGlobals(); vi.useRealTimers(); vi.resetModules(); scheduled.length = 0;
});

it("returns all 77 provinces, six regional totals, exact attribution and per-place results from one cached national grid", async () => {
  maskMode.real = true;
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-05T04:00:00Z"));
  const fetchMock = vi.fn(async () => tileResponse());
  vi.stubGlobal("fetch", fetchMock);
  const { GET } = await import("./route");
  const response = await GET(request("?lat=13.7279&lon=100.5241"));
  const payload = await response.json();
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toContain("s-maxage=21600");
  expect(payload).toMatchObject({ date: "2026-10-04", fetchedAt: "2026-10-05T04:00:00.000Z", stale: false,
    attribution: ["NASA LANCE/GIBS VIIRS flood", "geoBoundaries / © OpenStreetMap contributors (ODbL)"],
    sampling: { zoom: 7, tileSize: 256, unit: "grid-pixel-centres" }, nearMe: { lat: 13.7279, lon: 100.5241, radiusKm: 30 } });
  expect(Object.keys(payload.provinceCounts)).toHaveLength(77);
  expect(Object.keys(payload.regionCounts)).toHaveLength(6);
  expect(payload.provinceCounts.bangkok.sampled).toBeGreaterThan(0);
  expect(payload.nearMe.counts.sampled).toBeGreaterThan(0);
  const provinceSum = Object.values(payload.provinceCounts).reduce((sum: number, count) => sum + (count as { sampled: number }).sampled, 0);
  const regionSum = Object.values(payload.regionCounts).reduce((sum: number, count) => sum + (count as { sampled: number }).sampled, 0);
  expect(regionSum).toBe(provinceSum);
  expect(provinceSum).toBeLessThan(thailandTiles().length * 65536);
  expect(fetchMock).toHaveBeenCalledTimes(thailandTiles().length);
  expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("VIIRS_Combined_Flood_2-Day/default/2026-10-04/GoogleMapsCompatible_Level9/7/"),
    expect.objectContaining({ next: { revalidate: 21600 } }));

  vi.setSystemTime(new Date("2026-10-05T09:59:59Z"));
  const second = await (await GET(request("?lat=16.0538&lon=103.652"))).json();
  expect(second.provinceCounts).toEqual(payload.provinceCounts);
  expect(second.nearMe).toMatchObject({ lat: 16.0538, lon: 103.652 });
  expect(fetchMock).toHaveBeenCalledTimes(thailandTiles().length);
  expect((await (await GET(request())).json()).nearMe).toBeUndefined();
}, 30_000);

it("serves marked stale data after six hours and keeps it if NASA fails", async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-05T01:00:00Z"));
  const fetchMock = vi.fn(async () => tileResponse()); vi.stubGlobal("fetch", fetchMock);
  const { GET } = await import("./route");
  const original = await (await GET(request())).json();
  vi.setSystemTime(new Date("2026-10-05T07:00:00Z"));
  fetchMock.mockImplementation(async () => new Response(null, { status: 503 }));
  const response = await GET(request());
  expect(await response.json()).toEqual({ ...original, stale: true });
  expect(response.headers.get("Cache-Control")).toContain("s-maxage=300");
  expect(scheduled).toHaveLength(1);
  await scheduled[0]();
  expect((await (await GET(request())).json()).stale).toBe(true);
});

it("opts into capped national samples with either query and keeps all counts and the near-me verdict unchanged", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => tileResponse()));
  const viirs = await import("@/lib/flood/viirs");
  const samples = Array.from({ length: 6500 }, (_, i) => ({
    lat: 13.7279123 + i * 0.000001, lon: 100.5241567, provinceId: "bangkok",
    kind: i < 500 ? "dry" as const : i % 2 ? "flood" as const : "recurring-flood" as const,
  }));
  const sampling = vi.spyOn(viirs, "sampleTiles").mockReturnValue(samples);
  try {
    const { GET } = await import("./route");
    const original = await (await GET(request("?lat=13.7279&lon=100.5241"))).json();
    expect(original.samples).toBeUndefined();
    expect(original.sampleCap).toBeUndefined();
    expect(original.thinned).toBeUndefined();
    expect(original.nearMe).toMatchObject({ sampleCap: 400, thinned: true, verdict: "flood",
      counts: { sampled: 6500, dry: 500, flood: 3000, recurringFlood: 3000 } });
    expect(original.nearMe.samples).toHaveLength(400);
    for (const query of ["scope=th", "samples=th"]) {
      const payload = await (await GET(request(`?lat=13.7279&lon=100.5241&${query}`))).json();
      expect(payload).toMatchObject({ sampleCap: 3000, thinned: true });
      expect(payload.samples).toHaveLength(3000);
      expect(payload.samples.every((point: { lat: number; lon: number; kind: string }) =>
        (point.kind === "flood" || point.kind === "recurring-flood") &&
        point.lat === Number(point.lat.toFixed(4)) && point.lon === Number(point.lon.toFixed(4)) &&
        Object.keys(point).length === 3)).toBe(true);
      expect(payload).toEqual({ ...original, samples: payload.samples, sampleCap: 3000, thinned: true });
    }
    const unrequested = await (await GET(request("?scope=near&samples=true"))).json();
    expect(unrequested.samples).toBeUndefined();
    expect(unrequested.provinceCounts.bangkok.sampled).toBe(6500);
    expect(unrequested.regionCounts.central.sampled).toBe(6500);
  } finally { sampling.mockRestore(); }
});

it("fetches a new observation date after UTC midnight and never relabels yesterday's cache", async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-05T23:59:59Z"));
  const fetchMock = vi.fn(async () => tileResponse()); vi.stubGlobal("fetch", fetchMock);
  const { GET } = await import("./route");
  expect((await (await GET(request())).json()).date).toBe("2026-10-04");
  vi.setSystemTime(new Date("2026-10-06T00:00:00Z"));
  fetchMock.mockImplementation(async () => new Response(null, { status: 503 }));
  expect((await GET(request())).status).toBe(503);
  fetchMock.mockImplementation(async () => tileResponse());
  expect((await (await GET(request())).json()).date).toBe("2026-10-05");
});

it.each(["unpublished", "partial"])("falls back exactly one day for %s tiles and caches the actual observation date", async (failure) => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-05T04:00:00Z"));
  let latestCalls = 0;
  const fetchMock = vi.fn(async (url: string) => {
    if (url.includes("/2026-10-04/")) {
      if (failure === "partial" && latestCalls++ === 0) return tileResponse();
      return new Response(null, { status: 404 });
    }
    if (url.includes("/2026-10-03/")) return tileResponse();
    throw new Error(`Unexpected observation date: ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  const { GET } = await import("./route");
  const response = await GET(request("?lat=18.79&lon=98.98"));
  const payload = await response.json();
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toContain("s-maxage=21600");
  expect(payload).toMatchObject({ date: "2026-10-03", stale: false, nearMe: { lat: 18.79, lon: 98.98 } });
  expect(fetchMock.mock.calls.filter(([url]) => url.includes("/2026-10-04/"))).not.toHaveLength(0);
  expect(fetchMock.mock.calls.filter(([url]) => url.includes("/2026-10-03/"))).toHaveLength(thailandTiles().length);
  const calls = fetchMock.mock.calls.length;
  expect(await (await GET(request())).json()).toEqual({ ...payload, nearMe: undefined });
  expect(fetchMock).toHaveBeenCalledTimes(calls);
});

it.each(["?lat=", "?lat=13", "?lat=91&lon=100", "?lat=13&lon=nope"])("rejects invalid coordinates %s before fetching", async (query) => {
  const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
  expect((await (await import("./route")).GET(request(query))).status).toBe(400);
  expect(fetchMock).not.toHaveBeenCalled();
});

it.each(["http", "unpublished", "png", "partial"])("returns no-store 503 when both dates have %s failure rather than zero-flood data", async (failure) => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-05T04:00:00Z"));
  const callsByDate = new Map<string, number>();
  const fetchMock = vi.fn(async (url: string) => {
    const date = url.split("/default/")[1].split("/")[0];
    const calls = callsByDate.get(date) ?? 0;
    callsByDate.set(date, calls + 1);
    if (failure === "png") return new Response("invalid PNG");
    if (failure === "partial" && calls > 0) return tileResponse();
    return new Response(null, { status: failure === "unpublished" ? 404 : 503 });
  });
  vi.stubGlobal("fetch", fetchMock);
  const response = await (await import("./route")).GET(request());
  expect(response.status).toBe(503);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(await response.json()).toEqual({ error: "upstream" });
  expect([...callsByDate.keys()]).toEqual(["2026-10-04", "2026-10-03"]);
});

it("deduplicates simultaneous national-grid requests", async () => {
  const fetchMock = vi.fn(async () => tileResponse()); vi.stubGlobal("fetch", fetchMock);
  const { GET } = await import("./route");
  const [a, b] = await Promise.all([GET(request()), GET(request("?lat=13&lon=100"))]);
  expect(a.status).toBe(200); expect(b.status).toBe(200);
  expect(fetchMock).toHaveBeenCalledTimes(thailandTiles().length);
});
