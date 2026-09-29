import { afterEach, describe, expect, it, vi } from "vitest";
import { latestTileTime } from "./route";

afterEach(() => vi.unstubAllGlobals());

describe("satellite tile time discovery", () => {
  const now = Date.parse("2026-09-29T14:26:00Z");

  it("checks the newest ten-minute slot first and stops at the first PNG", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response(null, { status: 200, headers: { "content-type": "image/png" } }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await latestTileTime("Himawari_AHI_Band13_Clean_Infrared", now, 1, 3, 10)).toBe("2026-09-29T13:10:00Z");
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      expect.stringContaining("/2026-09-29T13:20:00Z/GoogleMapsCompatible_Level6/2/1/3.png"),
      expect.stringContaining("/2026-09-29T13:10:00Z/GoogleMapsCompatible_Level6/2/1/3.png"),
    ]);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "HEAD" });
  });

  it("returns null after timeouts, non-PNG responses and the final half-hour slot", async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValue(new Response(null, { status: 200, headers: { "content-type": "text/xml" } }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await latestTileTime("IMERG_Precipitation_Rate_30min", now, 5, 10, 30)).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(10);
  });

  it("caches null results for ten minutes in the route response", async () => {
    vi.resetModules();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 404 })));
    const { GET } = await import("./route");
    const first = await GET();
    expect(await first.json()).toEqual({ himawari: null, imerg: null });
    expect(first.headers.get("Cache-Control")).toBe("public, s-maxage=600");
    const calls = vi.mocked(fetch).mock.calls.length;
    await GET();
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(calls);
  });
});
