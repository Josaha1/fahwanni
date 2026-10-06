import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { damEmbedData, provinceEmbedData } from "./embed-data";

const mocks = vi.hoisted(() => ({ dams: vi.fn(), trend: vi.fn(), flood: vi.fn(), refresh: vi.fn(), scheduled: [] as (() => Promise<unknown>)[] }));
vi.mock("next/server", () => ({ after: (task: () => Promise<unknown>) => mocks.scheduled.push(task) }));
vi.mock("@/lib/dams/client", () => ({ fetchDams: mocks.dams }));
vi.mock("@/lib/dams/trend-source", () => ({ getDamTrend: mocks.trend, refreshDamTrend: mocks.refresh }));
vi.mock("@/lib/flood/source", () => ({ getFloodSnapshot: mocks.flood }));

beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); mocks.scheduled.length = 0; });
afterEach(() => vi.useRealTimers());

it("uses reported payloads and refreshes stale trend data after rendering", async () => {
  mocks.dams.mockResolvedValue({ dams: [] });
  mocks.trend.mockResolvedValue({ trend: { dates: [] }, stale: true });
  mocks.flood.mockResolvedValue({ snapshot: { payload: { date: "2026-10-04" } } });
  expect(await damEmbedData()).toEqual({ dams: { dams: [] }, trend: { dates: [] } });
  expect(await provinceEmbedData()).toEqual({ dams: { dams: [] }, flood: { date: "2026-10-04" } });
  expect(mocks.refresh).not.toHaveBeenCalled();
  for (const task of mocks.scheduled) await task();
  expect(mocks.refresh).toHaveBeenCalledOnce();
});

it("bounds slow sources to three seconds without holding up either embed", async () => {
  let finish: (data: null) => void = () => {};
  const slow = new Promise<null>((resolve) => { finish = resolve; });
  mocks.dams.mockReturnValue(slow);
  mocks.trend.mockReturnValue(slow);
  mocks.flood.mockReturnValue(slow);
  const dam = damEmbedData();
  const province = provinceEmbedData();
  await vi.advanceTimersByTimeAsync(3000);
  expect(await dam).toEqual({ dams: null, trend: null });
  expect(await province).toEqual({ dams: null, flood: null });
  finish(null);
  for (const task of mocks.scheduled) await task();
});
