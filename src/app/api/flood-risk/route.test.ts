import { afterEach, expect, it, vi } from "vitest";

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

it("rejects a bad bbox and proxies a valid one with only levels 2–4", async () => {
  const fetchMock = vi.fn(async () => Response.json({ features: [
    { geometry: { coordinates: [100.5, 14.35] }, properties: { village_co: 1, risk_level: 3, mname: "บ้านหนึ่ง" } },
  ] }));
  vi.stubGlobal("fetch", fetchMock);
  const { GET } = await import("./route");
  expect((await GET(new Request("http://x/api/flood-risk?bbox=100,13,104,14"))).status).toBe(400);
  const response = await GET(new Request("http://x/api/flood-risk?bbox=100.41,14.2,100.6,14.45"));
  expect(response.status).toBe(200);
  expect((await response.json()).points).toEqual([expect.objectContaining({ id: "ddpm:1", level: 3 })]);
  expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toContain("risk_level+%3E%3D+2");
  // same snapped box → served from memory
  await GET(new Request("http://x/api/flood-risk?bbox=100.3,14.1,100.7,14.49"));
  expect(fetchMock).toHaveBeenCalledOnce();
});

it("returns 503 when DDPM is down and nothing is cached", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("ENOTFOUND"); }));
  const response = await (await import("./route")).GET(new Request("http://x/api/flood-risk?bbox=100.4,14.2,100.6,14.4"));
  expect(response.status).toBe(503);
});
