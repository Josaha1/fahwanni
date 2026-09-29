import { afterEach, expect, it, vi } from "vitest";
import fixture from "@/lib/dams/fixture-rid.json";

const scheduled = vi.hoisted(() => [] as Array<() => unknown>);
vi.mock("next/server", () => ({ after: (task: () => unknown) => { scheduled.push(task); } }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.resetModules();
  scheduled.length = 0;
});

async function loadRoute() { return (await import("./route")).GET; }

it("fetches both historical days in parallel, parses percentages, and caches the result", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-29T12:00:00+07:00"));
  const fetchMock = vi.fn(async (input: string) => {
    if (input.endsWith("/public")) return Response.json(fixture);
    const date = input.slice(-10);
    return Response.json({ ...fixture, date, data: fixture.data.map((group) => ({
      ...group, dam: group.dam.map((dam) => ({ ...dam, percent_storage: dam.percent_storage - (date.startsWith("2011") ? 4 : 2) })),
    })) });
  });
  vi.stubGlobal("fetch", fetchMock);
  const GET = await loadRoute();
  const response = await GET();
  const history = await response.json();
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toContain("s-maxage=86400");
  expect(history.dataDate).toBe(fixture.date);
  expect(history.lastYear.date).toBe("2025-09-29");
  expect(history.year2554.date).toBe("2011-09-29");
  expect(history.lastYear.pct["200101"] - history.year2554.pct["200101"]).toBeCloseTo(2);
  expect(fetchMock).toHaveBeenCalledTimes(3);
  expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/public/2011-09-29"),
    expect.objectContaining({ next: { revalidate: 86400 }, signal: expect.any(AbortSignal) }));
  vi.setSystemTime(new Date("2026-09-30T10:00:00+07:00"));
  expect(await (await GET()).json()).toEqual(history);
  expect(fetchMock).toHaveBeenCalledTimes(3);
});

it("keeps one day when the other fails and serves stale history during a failed refresh", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-29T12:00:00+07:00"));
  const fetchMock = vi.fn(async (input: string) => {
    if (input.endsWith("/public")) return Response.json(fixture);
    if (input.endsWith("/2011-09-29")) return new Response(null, { status: 503 });
    return Response.json({ ...fixture, date: "2025-09-29" });
  });
  vi.stubGlobal("fetch", fetchMock);
  const GET = await loadRoute();
  const original = await (await GET()).json();
  expect(original.lastYear).not.toBeNull();
  expect(original.year2554).toBeNull();
  vi.setSystemTime(new Date("2026-09-30T11:00:00+07:00"));
  fetchMock.mockImplementation(async () => { throw new Error("offline"); });
  expect(await (await GET()).json()).toEqual(original);
  expect(scheduled).toHaveLength(1);
  await scheduled[0]();
  expect(await (await GET()).json()).toEqual(original);
});

it("returns 503 when both historical days fail without a cached result", async () => {
  vi.stubGlobal("fetch", vi.fn(async (input: string) => input.endsWith("/public")
    ? Response.json(fixture) : new Response(null, { status: 503 })));
  const response = await (await loadRoute())();
  expect(response.status).toBe(503);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(await response.json()).toEqual({ error: "upstream" });
});
