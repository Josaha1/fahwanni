import { afterEach, expect, it, vi } from "vitest";
import { fetchWindDays } from "./client";
import { buildDays } from "./days";
import fixture from "./fixture-open-meteo.json";
import { gridPoints } from "./grid";

vi.mock("./client", () => ({ fetchWindDays: vi.fn() }));
vi.mock("next/server", () => ({ after: (task: () => unknown) => { void task(); } }));

const days = buildDays(gridPoints().map((_, index) => fixture[index % fixture.length]));
const HOUR = 60 * 60 * 1000;
const start = Date.parse("2026-09-28T00:00:00+07:00");
const request = (day?: string) => new Request(`http://localhost/api/wind${day === undefined ? "" : `?day=${day}`}`);

afterEach(() => {
  vi.useRealTimers();
  vi.resetModules();
  vi.mocked(fetchWindDays).mockReset();
});

async function loadRoute() {
  return (await import("../../app/api/wind/route")).GET;
}

it("shares one upstream fetch across day 0..6 and the legacy response", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(start);
  vi.mocked(fetchWindDays).mockResolvedValue(days);
  const GET = await loadRoute();
  for (let day = 0; day < 7; day++) {
    const response = await GET(request(String(day)));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("public, s-maxage=10800, stale-while-revalidate=86400");
    expect(body.day).toBe(day);
    expect(body.hours).toHaveLength(24);
    expect(body.u).toHaveLength(24);
    expect(body.u[0]).toHaveLength(361);
  }
  const legacy = await (await GET(request())).json();
  expect(legacy).not.toHaveProperty("day");
  expect(legacy.hours).toHaveLength(8);
  expect(legacy.precipHours).toHaveLength(12);
  expect(legacy.tempHours).toHaveLength(24);
  expect(fetchWindDays).toHaveBeenCalledTimes(1);
});

it("rejects malformed day before fetching and returns 404 for an unavailable day", async () => {
  vi.mocked(fetchWindDays).mockResolvedValue(days);
  const GET = await loadRoute();
  for (const invalid of ["x", "-1", "1.5", "01", ""]) {
    const response = await GET(request(invalid));
    expect(response.status).toBe(400);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  }
  expect(fetchWindDays).not.toHaveBeenCalled();
  const missing = await GET(request("9"));
  expect(missing.status).toBe(404);
  expect(await missing.json()).toEqual({ error: "day" });
  expect(missing.headers.get("Cache-Control")).toBe("no-store");
});

it("caches for 3 hours, then serves stale while refreshing", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(start);
  vi.mocked(fetchWindDays).mockResolvedValue(days);
  const GET = await loadRoute();
  await GET(request("0"));
  vi.setSystemTime(start + 3 * HOUR - 1);
  await GET(request("1"));
  expect(fetchWindDays).toHaveBeenCalledTimes(1);
  vi.setSystemTime(start + 3 * HOUR);
  expect((await GET(request("0"))).status).toBe(200);
  expect(fetchWindDays).toHaveBeenCalledTimes(2);
});

it("returns 503 when the first fetch fails", async () => {
  vi.mocked(fetchWindDays).mockResolvedValue(null);
  const GET = await loadRoute();
  const response = await GET(request());
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ error: "upstream" });
  expect(response.headers.get("Cache-Control")).toBe("no-store");
});

it("serves the last good days when Open-Meteo returns 429 after expiry", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(start);
  vi.mocked(fetchWindDays).mockResolvedValueOnce(days).mockResolvedValueOnce(null);
  const GET = await loadRoute();
  await GET(request("0"));
  vi.setSystemTime(start + 3 * HOUR);
  const response = await GET(request("1"));
  expect(response.status).toBe(200);
  expect((await response.json()).day).toBe(1);
  expect(fetchWindDays).toHaveBeenCalledTimes(2);
});
