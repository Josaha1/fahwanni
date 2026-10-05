import { afterEach, expect, it, vi } from "vitest";
import { DAM_REGISTRY } from "@/lib/dams/registry";
import { damGrid } from "@/lib/rain/dam-model";
import { GET } from "./route";

const dams = [...DAM_REGISTRY.slice(0, 3)].sort((a, b) => a.id.localeCompare(b.id));
const request = () => new Request(`https://example.test/api/rain-dams?ids=${dams.map((dam) => dam.id).join(",")}`);
const fixture = () => dams.flatMap((dam) => damGrid(dam).map((point) => ({ latitude: point.lat, longitude: point.lon, daily: { time: Array.from({ length: 7 }, (_, day) => `2026-10-${String(day + 5).padStart(2, "0")}`), precipitation_sum: Array(7).fill(10) } })));
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

it("rejects invalid ids before making upstream calls", async () => {
  const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
  expect((await GET(new Request("https://example.test/api/rain-dams?ids=bad"))).status).toBe(400);
  expect(fetchMock).not.toHaveBeenCalled();
});
it("batches all 27 points once, deduplicates concurrent callers, and caches for three hours", async () => {
  vi.useFakeTimers(); vi.setSystemTime(0);
  const fetchMock = vi.fn<typeof fetch>(async () => Response.json(fixture())); vi.stubGlobal("fetch", fetchMock);
  const responses = await Promise.all([GET(request()), GET(request())]);
  expect((await responses[0].json())[0].totals).toEqual([10, 30, 70]);
  expect(fetchMock).toHaveBeenCalledOnce();
  const url = new URL(String(fetchMock.mock.calls[0][0]));
  expect(url.searchParams.get("latitude")?.split(",")).toHaveLength(27);
  expect(url.searchParams.get("daily")).toBe("precipitation_sum");
  expect(fetchMock).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ next: { revalidate: 10800 } }));
  expect(responses[0].headers.get("Cache-Control")).toContain("s-maxage=10800");
  vi.setSystemTime(10800000 - 1); await GET(request()); expect(fetchMock).toHaveBeenCalledOnce();
  vi.setSystemTime(10800000); await GET(request()); expect(fetchMock).toHaveBeenCalledTimes(2);
});
it("serves a dated stale result on failure and reports 503 after stale expiry", async () => {
  vi.useFakeTimers(); vi.setSystemTime(21600000);
  vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("quota"); }));
  const stale = await GET(request());
  expect(stale.status).toBe(200);
  expect((await stale.json())[0].date).toBe("2026-10-05");
  expect(stale.headers.get("Cache-Control")).toBe("no-store");
  vi.setSystemTime(30 * 3600000);
  expect((await GET(request())).status).toBe(503);
});
