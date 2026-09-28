import { rgbaToLevel } from "@/lib/nowcast/intensity";
import { globalPixel } from "@/lib/radar/summary";
import type { RadarFrame } from "@/lib/radar/types";

export function loadTile(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

export async function readRadarLevel(frame: RadarFrame, lon: number, lat: number, z = 7): Promise<number> {
  try {
    const pixel = globalPixel(lon, lat, z);
    const tx = Math.floor(pixel.x / 256), ty = Math.floor(pixel.y / 256);
    const url = frame.tileUrl.replace("{z}", String(z)).replace("{x}", String(tx)).replace("{y}", String(ty));
    const image = await loadTile(url);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return -1;
    ctx.drawImage(image, Math.floor(pixel.x - tx * 256), Math.floor(pixel.y - ty * 256), 1, 1, 0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    return rgbaToLevel(r, g, b, a);
  } catch { return -1; }
}
