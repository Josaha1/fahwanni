import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { fetchRadar } from "./client";
import { toManifest } from "./rainviewer";
import fixture from "./fixture-rainviewer.json";

vi.mock("./client", () => ({ fetchRadar: vi.fn() }));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});
afterEach(() => vi.useRealTimers());

it("caches the radar response for five minutes", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
  const { GET } = await import("../../app/api/radar/route");
  const manifest = toManifest(fixture);
  vi.mocked(fetchRadar).mockResolvedValue(manifest);
  const first = await GET();
  expect(await first.json()).toEqual(manifest);
  expect(first.headers.get("Cache-Control")).toBe("public, s-maxage=300, stale-while-revalidate=600");
  vi.setSystemTime(5 * 60 * 1000 - 1);
  await GET();
  expect(fetchRadar).toHaveBeenCalledOnce();
  vi.setSystemTime(5 * 60 * 1000);
  await GET();
  expect(fetchRadar).toHaveBeenCalledTimes(2);
});

it("returns a stale RainViewer manifest without caching it", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
  const { GET } = await import("../../app/api/radar/route");
  const manifest = { ...toManifest(fixture), stale: true };
  vi.mocked(fetchRadar).mockResolvedValue(manifest);

  const first = await GET();
  expect(await first.json()).toEqual(manifest);
  expect(first.headers.get("Cache-Control")).toBe("public, s-maxage=300, stale-while-revalidate=600");
  await GET();
  expect(fetchRadar).toHaveBeenCalledTimes(2);
});
