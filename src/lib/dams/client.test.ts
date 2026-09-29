import { afterEach, expect, it, vi } from "vitest";
import fixture from "./fixture-thaiwater.json";
import { fetchDams } from "./client";

afterEach(() => vi.useRealTimers());

it("fetches and trims the ThaiWater feed without using the Next data cache", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-29T04:59:00.000Z"));
  const fetchImpl = vi.fn(async () => Response.json(fixture));

  const payload = await fetchDams(fetchImpl as typeof fetch);

  expect(fetchImpl).toHaveBeenCalledOnce();
  expect(fetchImpl).toHaveBeenCalledWith(
    "https://api-v3.thaiwater.net/api/v1/thaiwater30/public/thailand_main",
    { cache: "no-store", signal: expect.any(AbortSignal) },
  );
  expect(payload).toMatchObject({
    dataDate: "2026-09-28", fetchedAt: "2026-09-29T04:59:00.000Z", stale: false,
    dams: expect.any(Array), stations: expect.any(Array), barrage: { id: "chao-phraya" },
  });
  expect(payload?.dams).toHaveLength(10);
  expect(payload?.stations).toHaveLength(7);

  vi.setSystemTime(new Date("2026-09-29T05:00:01.000Z"));
  expect((await fetchDams(fetchImpl as typeof fetch))?.stale).toBe(true);
});

it("drops stations without coordinates", async () => {
  const raw = structuredClone(fixture);
  delete (raw.waterlevel.data.data[0].station as { tele_station_lat?: unknown }).tele_station_lat;
  const fetchImpl = vi.fn(async () => Response.json(raw));
  const payload = await fetchDams(fetchImpl as typeof fetch);
  expect(payload?.stations).toHaveLength(6);
});

it("returns null on a 429, malformed response, or empty dams", async () => {
  for (const response of [
    new Response(null, { status: 429 }),
    Response.json("garbage"),
    Response.json({ dam: { data: { data: [] } } }),
  ]) {
    const fetchImpl = vi.fn(async () => response);
    await expect(fetchDams(fetchImpl as typeof fetch)).resolves.toBeNull();
  }
});
