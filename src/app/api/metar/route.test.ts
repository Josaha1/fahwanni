import { afterEach, expect, it, vi } from "vitest";

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

it("accepts only known Thai airports and parses the reports", async () => {
  const fetchMock = vi.fn(async () => Response.json([{ icaoId: "VTBS", obsTime: 1790850600, temp: 28, dewp: 23, wdir: 300, wspd: 8,
    rawOb: "METAR VTBS 011030Z 30008KT 9999 FEW020 28/23 Q1010 NOSIG" }]));
  vi.stubGlobal("fetch", fetchMock);
  const { GET } = await import("./route");
  expect((await GET(new Request("http://x/api/metar?ids=KJFK"))).status).toBe(400);
  const payload = await (await GET(new Request("http://x/api/metar?ids=vtbs,KJFK"))).json();
  expect(payload.items).toEqual([expect.objectContaining({ icao: "VTBS", tempC: 28 })]);
  expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toContain("ids=VTBS&");
  await GET(new Request("http://x/api/metar?ids=VTBS"));
  expect(fetchMock).toHaveBeenCalledOnce();
});
