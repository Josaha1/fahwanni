import { afterEach, expect, it, vi } from "vitest";
import fixture from "@/lib/dams/fixture-rid.json";
import { GET } from "./route";

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

it("loads dated RID reports, skips a failed date, and caches the trend for six hours", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-29T12:00:00+07:00"));
  const fetchMock = vi.fn(async (input: string) => {
    if (input.endsWith("/public")) return Response.json(fixture);
    const date = input.slice(-10);
    if (date === "2026-09-25") return new Response(null, { status: 503 });
    return Response.json({ ...fixture, date, data: fixture.data.map((group) => ({
      ...group, dam: group.dam.map((dam) => ({ ...dam, percent_storage: dam.percent_storage - 1 })),
    })) });
  });
  vi.stubGlobal("fetch", fetchMock);
  const response = await GET();
  const trend = await response.json();
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe("public, s-maxage=21600, stale-while-revalidate=86400");
  expect(trend.dates).toHaveLength(7);
  expect(trend.dates[0]).toBe("2026-09-22");
  expect(trend.dates).not.toContain("2026-09-25");
  expect(trend.dates.at(-1)).toBe(fixture.date);
  expect(trend.pct["200101"]).toHaveLength(7);
  expect(trend.inflow["200101"]).toHaveLength(7);
  expect(trend.inflow["200101"].at(-1)).toEqual(expect.any(Number));
  expect(fetchMock).toHaveBeenCalledTimes(8);
  expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/public/2026-09-22"), expect.objectContaining({ next: { revalidate: 21600 } }));
  vi.setSystemTime(new Date("2026-09-29T17:59:59+07:00"));
  await GET();
  expect(fetchMock).toHaveBeenCalledTimes(8);
});

it("skips failed dates and returns 503 when the current report is unavailable", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-01T12:00:00+07:00"));
  vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
  const response = await GET();
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ error: "upstream" });
});
