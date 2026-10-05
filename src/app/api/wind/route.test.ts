import { afterEach, expect, it, vi } from "vitest";
import { buildDays } from "@/lib/wind/days";
import { gridPoints } from "@/lib/wind/grid";
import fixture from "@/lib/wind/fixture-open-meteo.json";

vi.mock("next/server", () => ({ after: vi.fn() }));
vi.mock("@/lib/wind/client", () => ({ fetchWindDays: vi.fn() }));
import { fetchWindDays } from "@/lib/wind/client";
import { GET } from "./route";
afterEach(() => vi.useRealTimers());

it("answers rain totals and legacy/day consumers from the same cached upstream grid", async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-09-28T00:00:00+07:00"));
  const days = buildDays(gridPoints().map((_, index) => structuredClone(fixture[index % fixture.length])));
  vi.mocked(fetchWindDays).mockResolvedValue(days);
  const first = await GET(new Request("https://example.test/api/wind?rain=1&lat=13.75&lon=100.5"));
  const body = await first.json();
  expect(body.date).toBe("2026-09-28");
  expect(body.totals).toHaveLength(3);
  expect(body.totals.every((value: unknown) => typeof value === "number")).toBe(true);
  expect((await GET(new Request("https://example.test/api/wind?day=0"))).status).toBe(200);
  expect((await GET()).status).toBe(200);
  expect(fetchWindDays).toHaveBeenCalledOnce();
});
it("rejects missing or non-Thai rain positions without refetching", async () => {
  expect((await GET(new Request("https://example.test/api/wind?rain=1"))).status).toBe(400);
  expect((await GET(new Request("https://example.test/api/wind?rain=1&lat=50&lon=100"))).status).toBe(400);
  expect(fetchWindDays).not.toHaveBeenCalled();
});
