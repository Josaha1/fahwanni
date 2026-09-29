import { afterEach, expect, it, vi } from "vitest";
import { fetchDams, type DamsPayload } from "./client";

vi.mock("./client", () => ({ fetchDams: vi.fn() }));
vi.mock("next/server", () => ({ after: (task: () => unknown) => { void task(); } }));

const payload = {
  dataDate: "2026-09-28", fetchedAt: "2026-09-29T00:00:00.000Z", stale: false,
  dams: [], barrage: null, stations: [],
} satisfies DamsPayload;
const HOUR = 60 * 60 * 1000;

afterEach(() => {
  vi.useRealTimers();
  vi.resetModules();
  vi.mocked(fetchDams).mockReset();
});

async function loadRoute() {
  return (await import("../../app/api/dams/route")).GET;
}

it("serves a fresh hit without fetching again", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
  vi.mocked(fetchDams).mockResolvedValue(payload);
  const GET = await loadRoute();
  const first = await GET();
  expect(first.status).toBe(200);
  expect(first.headers.get("Cache-Control")).toBe("public, s-maxage=3600, stale-while-revalidate=86400");
  vi.setSystemTime(HOUR - 1);
  expect(await (await GET()).json()).toEqual(payload);
  expect(fetchDams).toHaveBeenCalledOnce();
});

it("serves stale data immediately when the upstream refresh fails", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
  vi.mocked(fetchDams).mockResolvedValueOnce(payload).mockResolvedValueOnce(null);
  const GET = await loadRoute();
  await GET();
  vi.setSystemTime(HOUR);
  const response = await GET();
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual(payload);
  expect(fetchDams).toHaveBeenCalledTimes(2);
});

it("returns 503 with no-store when no cached data exists", async () => {
  vi.mocked(fetchDams).mockResolvedValue(null);
  const response = await (await loadRoute())();
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ error: "upstream" });
  expect(response.headers.get("Cache-Control")).toBe("no-store");
});
