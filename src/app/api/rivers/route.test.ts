import { afterEach, expect, it, vi } from "vitest";
import fixture from "@/lib/rivers/fixture-flood.json";
import observedData from "../../../../public/data/observed-points.json";
import pointsData from "../../../../public/data/river-points.json";

const scheduled = vi.hoisted(() => [] as Array<() => unknown>);
const rid = vi.hoisted(() => ({ dams: null as null | { dams: { id: string; date: string; releaseCms: number | null }[] } }));
vi.mock("next/server", () => ({ after: (task: () => unknown) => { scheduled.push(task); } }));
vi.mock("@/lib/dams/client", () => ({ fetchDams: async () => rid.dams }));
vi.mock("@/lib/dams/trend-source", () => ({ getDamTrend: async () => null }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.resetModules();
  scheduled.length = 0;
  rid.dams = null;
});

async function loadRoute() {
  return (await import("./route")).GET;
}

it("returns summaries for every point from one upstream request and caches them for six hours", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-28T17:30:00Z"));
  const fetchMock = vi.fn(async () => Response.json(fixture));
  vi.stubGlobal("fetch", fetchMock);
  const GET = await loadRoute();
  const response = await GET();
  const payload = await response.json();

  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe("public, s-maxage=21600, stale-while-revalidate=86400");
  expect(payload.fetchedAt).toBe("2026-09-28T17:30:00.000Z");
  expect(payload.today).toBe("2026-09-29");
  expect(payload.source).toBe("GloFAS v4 via Open-Meteo Flood API (CC BY 4.0) · RID dam release · HII open data (CC BY-NC)");
  expect(payload.points).toHaveLength(pointsData.points.length + observedData.points.length);
  expect(payload.points[0]).toEqual({
    id: pointsData.points[0].id, nameTh: pointsData.points[0].nameTh,
    nameEn: pointsData.points[0].nameEn, river: pointsData.points[0].river,
    provinceId: pointsData.points[0].provinceId, lat: pointsData.points[0].lat,
    lon: pointsData.points[0].lon, kind: "model", downstreamOfDam: pointsData.points[0].downstreamOfDam,
    upstreamDams: pointsData.points[0].upstreamDams,
    summary: expect.objectContaining({ id: pointsData.points[0].id, today: expect.objectContaining({ date: "2026-09-29" }) }),
  });
  expect(JSON.stringify(payload)).not.toMatch(/"(?:doy|value2554)":/);
  expect(payload.points.at(-1)).toMatchObject({ kind: "observed", summary: null, release: null });
  expect(fetchMock).toHaveBeenCalledOnce();
  expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("flood-api.open-meteo.com/v1/flood?latitude="),
    expect.objectContaining({ next: { revalidate: 21600 } }));

  vi.setSystemTime(new Date("2026-09-28T20:00:00Z"));
  expect(await (await GET()).json()).toEqual(payload);
  expect(fetchMock).toHaveBeenCalledOnce();
});

it("serves stale data while refreshing and retains it when upstream fails", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-29T05:00:00Z"));
  const fetchMock = vi.fn().mockResolvedValueOnce(Response.json(fixture)).mockResolvedValueOnce(new Response(null, { status: 503 }));
  vi.stubGlobal("fetch", fetchMock);
  const GET = await loadRoute();
  const original = await (await GET()).json();

  vi.setSystemTime(new Date("2026-09-29T11:00:00Z"));
  const response = await GET();
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual(original);
  expect(scheduled).toHaveLength(1);
  await scheduled[0]();
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(await (await GET()).json()).toEqual(original);
});

it("recalculates today's summaries after Bangkok midnight", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-29T16:59:00Z"));
  const fetchMock = vi.fn(async () => Response.json(fixture));
  vi.stubGlobal("fetch", fetchMock);
  const GET = await loadRoute();
  expect((await (await GET()).json()).today).toBe("2026-09-29");

  vi.setSystemTime(new Date("2026-09-29T17:00:00Z"));
  const payload = await (await GET()).json();
  expect(payload.today).toBe("2026-09-30");
  expect(payload.points[0].summary.today.date).toBe("2026-09-30");
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

it("returns 503 with no-store when there is no usable forecast", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 503 })));
  const response = await (await loadRoute())();
  expect(response.status).toBe(503);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(await response.json()).toEqual({ error: "upstream" });
});

it("still serves observed points from RID when GloFAS fails", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-30T03:00:00Z"));
  vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 503 })));
  rid.dams = { dams: [
    { id: "200401", date: "2026-09-30", releaseCms: 20 }, { id: "200402", date: "2026-09-29", releaseCms: 12.5 },
  ] };
  const response = await (await loadRoute())();
  expect(response.status).toBe(200);
  const payload = await response.json();
  expect(payload.points.filter((point: { kind: string }) => point.kind === "model")
    .every((point: { summary: unknown }) => point.summary === null)).toBe(true);
  const maeklong = payload.points.find((point: { id: string }) => point.id === "maeklong-ratchaburi");
  expect(maeklong).toMatchObject({ kind: "observed", releaseDams: ["200401", "200402"],
    release: { today: { date: "2026-09-29", totalCms: 32.5, missing: [] } } });
  const thachin = payload.points.find((point: { id: string }) => point.id === "thachin-suphanburi");
  expect(thachin.release).toBeNull();
});
