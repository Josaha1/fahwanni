import { afterEach, expect, it, vi } from "vitest";

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });
const row = (lat: number, lon: number, sst: number, dhw: number, baa: number) => ["2026-09-29T12:00:00Z", lat, lon, sst, dhw, baa];
const answer = (rows: unknown[][]) => Response.json({ table: { columnNames: ["time", "latitude", "longitude", "CRW_SST", "CRW_DHW", "CRW_BAA"], rows } });

it("answers a sea point, ignores places far from Thai seas and caches by point", async () => {
  const fetchMock = vi.fn(async () => answer([row(10.125, 99.875, 29.6, 0, 0)]));
  vi.stubGlobal("fetch", fetchMock);
  const { GET } = await import("./route");
  expect((await (await GET(new Request("http://x/api/sea?lat=35&lon=139"))).json()).reading).toBeNull();
  const first = await (await GET(new Request("http://x/api/sea?lat=10.1&lon=99.84"))).json();
  expect(first.reading).toMatchObject({ sstC: 29.6, level: 0 });
  await GET(new Request("http://x/api/sea?lat=10.1&lon=99.84"));
  expect(fetchMock).toHaveBeenCalledOnce();
});

it("lists all dive spots and 503s only when every spot fails", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => answer([row(8.65, 97.65, 29.9, 1.2, 1)])));
  const payload = await (await (await import("./route")).GET(new Request("http://x/api/sea?spots=1"))).json();
  expect(payload.spots).toHaveLength(8);
  expect(payload.spots[0].reading).toMatchObject({ level: 1 });
  vi.resetModules();
  vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 500 })));
  expect((await (await import("./route")).GET(new Request("http://x/api/sea?spots=1"))).status).toBe(503);
});
