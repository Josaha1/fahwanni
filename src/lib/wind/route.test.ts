import { afterEach, expect, it, vi } from "vitest";
import { fetchWindGrid } from "./client";
import type { WindGrid } from "./grid";

vi.mock("./client", () => ({ fetchWindGrid: vi.fn() }));
vi.mock("next/server", () => ({ after: (task: () => unknown) => { void task(); } }));

const grid = { hours: ["2026-09-28T00:00:00.000Z"] } as WindGrid;
const HOUR = 60 * 60 * 1000;

afterEach(() => {
  vi.useRealTimers();
  vi.resetModules();
  vi.mocked(fetchWindGrid).mockReset();
});

async function loadRoute() {
  return (await import("../../app/api/wind/route")).GET;
}

it("caches for 3 hours, then serves stale while refreshing", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
  vi.mocked(fetchWindGrid).mockResolvedValue(grid);
  const GET = await loadRoute();

  const first = await GET();
  expect(first.status).toBe(200);
  expect(first.headers.get("Cache-Control")).toBe("public, s-maxage=10800, stale-while-revalidate=86400");

  vi.setSystemTime(3 * HOUR - 1);
  await GET();
  expect(fetchWindGrid).toHaveBeenCalledOnce();

  vi.setSystemTime(3 * HOUR);
  const stale = await GET();
  expect(stale.status).toBe(200);
  expect(fetchWindGrid).toHaveBeenCalledTimes(2);
});

it("returns 503 when the first fetch fails", async () => {
  vi.mocked(fetchWindGrid).mockResolvedValue(null);
  const GET = await loadRoute();
  const response = await GET();
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ error: "upstream" });
  expect(response.headers.get("Cache-Control")).toBe("no-store");
});
