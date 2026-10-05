import { afterEach, expect, it, vi } from "vitest";
import { availableFloodReports, floodReplayDates } from "./gibs-replay";

const png = () => new Response(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), { headers: { "content-type": "image/png" } });
const pixels = (count: number, color = [250, 30, 36, 255]) => {
  const data = new Uint8ClampedArray(200 * 4);
  for (let index = 0; index < count; index++) data.set(color, index * 4);
  return { width: 20, height: 10, data };
};
const decode = async () => pixels(2);
afterEach(() => vi.unstubAllGlobals());
it("checks seven daily dates ending yesterday UTC across year and leap-day boundaries", () => {
  expect(floodReplayDates(Date.parse("2026-01-02T00:00:00Z"))).toEqual([
    "2025-12-26", "2025-12-27", "2025-12-28", "2025-12-29", "2025-12-30", "2025-12-31", "2026-01-01",
  ]);
  expect(floodReplayDates(Date.parse("2024-03-02T01:00:00+07:00")).at(-1)).toBe("2024-02-29");
});
it("keeps only reported tiles and records MODIS fallback for the selected date", async () => {
  const request = vi.fn<typeof fetch>(async (url) => {
    const path = String(url);
    if (path.includes("2026-01-01") || (path.includes("2026-01-03") && path.includes("MODIS"))) return png();
    return new Response("missing", { status: 404 });
  });
  expect(await availableFloodReports(["2026-01-01", "2026-01-02", "2026-01-03"], new AbortController().signal, request, decode)).toEqual([
    { date: "2026-01-01", layer: "VIIRS_Combined_Flood_2-Day" },
    { date: "2026-01-03", layer: "MODIS_Combined_Flood_2-Day" },
  ]);
  expect(request).toHaveBeenCalledTimes(5);
});
it("omits XML errors, corrupt tiles and network errors even with HTTP 200", async () => {
  for (const response of [() => new Response("<Exception/>", { headers: { "content-type": "text/xml" } }),
    () => new Response("bad png", { headers: { "content-type": "image/png" } }), () => { throw new Error("offline"); }]) {
    expect(await availableFloodReports(["2026-01-01"], new AbortController().signal, vi.fn<typeof fetch>(async () => response()))).toEqual([]);
  }
});
it("does not request tiles after cancellation", async () => {
  const controller = new AbortController(); controller.abort();
  const request = vi.fn<typeof fetch>();
  expect(await availableFloodReports(["2026-01-01"], controller.signal, request)).toEqual([]);
  expect(request).not.toHaveBeenCalled();
});
it.each([
  [0, [250, 30, 36, 255]],
  [200, [0, 0, 0, 255]],
  [200, [250, 30, 36, 0]],
  [1, [250, 30, 36, 255]],
])("omits empty, nodata, transparent and below-1%% tiles (%i pixels, %j)", async (count, color) => {
  expect(await availableFloodReports(["2026-01-01"], new AbortController().signal,
    vi.fn<typeof fetch>(async () => png()), async () => pixels(count, color))).toEqual([]);
});
it("counts exactly 1% visible data and falls back to MODIS when VIIRS is empty", async () => {
  const decoder = vi.fn().mockResolvedValueOnce(pixels(0)).mockResolvedValueOnce(pixels(2));
  expect(await availableFloodReports(["2026-01-01"], new AbortController().signal,
    vi.fn<typeof fetch>(async () => png()), decoder)).toEqual([{ date: "2026-01-01", layer: "MODIS_Combined_Flood_2-Day" }]);
});
it("omits tiles on decode failure or unavailable canvas", async () => {
  for (const decoder of [async () => { throw new Error("decode failed"); }, async () => null]) {
    expect(await availableFloodReports(["2026-01-01"], new AbortController().signal,
      vi.fn<typeof fetch>(async () => png()), decoder)).toEqual([]);
  }
  vi.stubGlobal("OffscreenCanvas", undefined);
  vi.stubGlobal("document", undefined);
  const close = vi.fn();
  vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue({ width: 20, height: 10, close }));
  expect(await availableFloodReports(["2026-01-01"], new AbortController().signal,
    vi.fn<typeof fetch>(async () => png()))).toEqual([]);
  expect(close).toHaveBeenCalledTimes(2);
});
it.each(["offscreen", "canvas"])("decodes browser tiles using %s and releases the bitmap", async (mode) => {
  const close = vi.fn(), drawImage = vi.fn(), getImageData = vi.fn(() => pixels(2));
  const canvas = { width: 0, height: 0, getContext: vi.fn(() => ({ drawImage, getImageData })) };
  const bitmap = { width: 20, height: 10, close };
  vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue(bitmap));
  vi.stubGlobal("OffscreenCanvas", mode === "offscreen" ? class { constructor() { return canvas; } } : undefined);
  vi.stubGlobal("document", { createElement: vi.fn(() => canvas) });
  expect(await availableFloodReports(["2026-01-01"], new AbortController().signal,
    vi.fn<typeof fetch>(async () => png()))).toEqual([{ date: "2026-01-01", layer: "VIIRS_Combined_Flood_2-Day" }]);
  expect(drawImage).toHaveBeenCalledWith(bitmap, 0, 0);
  expect(getImageData).toHaveBeenCalledWith(0, 0, 20, 10);
  expect([canvas.width, canvas.height]).toEqual([20, 10]);
  expect(close).toHaveBeenCalledOnce();
});
it("does not count a tile if cancelled during decoding", async () => {
  const controller = new AbortController();
  expect(await availableFloodReports(["2026-01-01"], controller.signal,
    vi.fn<typeof fetch>(async () => png()), async () => { controller.abort(); return pixels(2); })).toEqual([]);
});
