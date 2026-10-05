import { floodDate, gibsTileUrl, type FloodLayer } from "./gibs";

export type FloodReport = { date: string; layer: FloodLayer };
type TilePixels = Pick<ImageData, "width" | "height" | "data">;
type TileDecoder = (tile: Blob) => Promise<TilePixels | null>;

async function decodeFloodTile(tile: Blob): Promise<TilePixels | null> {
  if (typeof createImageBitmap !== "function") return null;
  const bitmap = await createImageBitmap(tile, { colorSpaceConversion: "none", premultiplyAlpha: "none" });
  try {
    const canvas = typeof OffscreenCanvas === "function" ? new OffscreenCanvas(bitmap.width, bitmap.height)
      : typeof document !== "undefined" ? document.createElement("canvas") : null;
    if (!canvas) return null;
    canvas.width = bitmap.width; canvas.height = bitmap.height;
    const context = canvas.getContext("2d") as OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null;
    if (!context) return null;
    context.drawImage(bitmap, 0, 0);
    return context.getImageData(0, 0, bitmap.width, bitmap.height);
  } finally { bitmap.close(); }
}

function hasReportedPixels({ width, height, data }: TilePixels): boolean {
  const total = width * height;
  if (total < 1 || data.length !== total * 4) return false;
  let reported = 0;
  for (let offset = 0; offset < data.length; offset += 4) {
    // GIBS palette index 0 is black nodata; transparent land is also excluded.
    if (data[offset + 3] > 0 && (data[offset] !== 0 || data[offset + 1] !== 0 || data[offset + 2] !== 0)) reported++;
  }
  return reported >= Math.ceil(total * 0.01);
}

export function floodReplayDates(nowMs: number): string[] {
  const newest = Date.parse(`${floodDate(nowMs)}T00:00:00Z`);
  return Array.from({ length: 7 }, (_, index) => new Date(newest - (6 - index) * 86_400_000).toISOString().slice(0, 10));
}

/** HTTP 200 includes empty composites; require visible data in at least 1% of the tile. */
export async function availableFloodReports(dates: string[], signal: AbortSignal, request: typeof fetch = fetch,
  decode: TileDecoder = decodeFloodTile): Promise<FloodReport[]> {
  const results = await Promise.all(dates.map(async (date): Promise<FloodReport | null> => {
    for (const layer of ["VIIRS_Combined_Flood_2-Day", "MODIS_Combined_Flood_2-Day"] as const) {
      if (signal.aborted) return null;
      try {
        const response = await request(gibsTileUrl(layer, date, { z: 6, y: 29, x: 50 }), {
          signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]),
        });
        if (!response.ok || !response.headers.get("content-type")?.includes("image/png")) continue;
        const tile = await response.blob();
        const bytes = new Uint8Array(await tile.arrayBuffer());
        if (![137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte)) continue;
        const pixels = await decode(tile);
        if (!signal.aborted && pixels && hasReportedPixels(pixels)) return { date, layer };
      } catch { /* Missing daily composites are omitted, including when both providers fail. */ }
    }
    return null;
  }));
  return results.filter((report): report is FloodReport => report !== null);
}
