import { afterEach, expect, it, vi } from "vitest";
import { fetchPm25Grid } from "./client";
import type { Pm25Grid } from "./grid";

vi.mock("./client", () => ({ fetchPm25Grid: vi.fn() }));
vi.mock("next/server", () => ({ after: (task: () => unknown) => { void task(); } }));

const grid = { hours: ["2026-09-28T00:00:00.000Z"], pm25: [[12.3]] } as Pm25Grid;
const HOUR = 60 * 60 * 1000;

afterEach(() => {
  vi.useRealTimers();
  vi.resetModules();
  vi.mocked(fetchPm25Grid).mockReset();
});

async function loadRoute() {
  return (await import("../../app/api/pm25/route")).GET;
}

it("serves a fresh hit without fetching again", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
  vi.mocked(fetchPm25Grid).mockResolvedValue(grid);
  const GET = await loadRoute();
  const first = await GET();
  expect(first.status).toBe(200);
  expect(first.headers.get("Cache-Control")).toBe("public, s-maxage=10800, stale-while-revalidate=86400");
  vi.setSystemTime(3 * HOUR - 1);
  expect(await (await GET()).json()).toEqual(grid);
  expect(fetchPm25Grid).toHaveBeenCalledOnce();
});

it("serves stale immediately and preserves it when the refresh gets 429", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
  vi.mocked(fetchPm25Grid).mockResolvedValueOnce(grid).mockResolvedValueOnce(null);
  const GET = await loadRoute();
  await GET();
  vi.setSystemTime(3 * HOUR);
  const response = await GET();
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual(grid);
  expect(fetchPm25Grid).toHaveBeenCalledTimes(2);
});

it("returns 503 with no-store when the first fetch gets 429", async () => {
  vi.mocked(fetchPm25Grid).mockResolvedValue(null);
  const response = await (await loadRoute())();
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ error: "upstream" });
  expect(response.headers.get("Cache-Control")).toBe("no-store");
});
