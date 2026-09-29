"use client";

import type { Map } from "maplibre-gl";
import type { Locale, T } from "@/i18n/core";
import type { PrimaryLayer } from "@/lib/map/legend";
import { wrapText } from "@/lib/wrap-text";

const W = 1080;
const H = 1350;

export function coverCrop(sourceWidth: number, sourceHeight: number, targetWidth: number, targetHeight: number) {
  if (Math.min(sourceWidth, sourceHeight, targetWidth, targetHeight) <= 0) throw new Error("Invalid map image size");
  const ratio = targetWidth / targetHeight;
  const wide = sourceWidth / sourceHeight > ratio;
  const width = wide ? sourceHeight * ratio : sourceWidth;
  const height = wide ? sourceHeight : sourceWidth / ratio;
  return { x: (sourceWidth - width) / 2, y: (sourceHeight - height) / 2, width, height };
}

export function mapSourceLine({ water, primary, radar, rainRisk, rainAccum }: {
  water: boolean; primary: PrimaryLayer; radar: boolean; rainRisk: boolean; rainAccum: boolean;
}): string[] {
  if (water) return ["GloFAS ผ่าน Open-Meteo (CC BY 4.0)", "กรมชลประทาน", ...(rainRisk ? ["กรมอุตุนิยมวิทยา"] : []),
    ...(rainAccum ? ["Open-Meteo"] : []), ...(radar ? ["RainViewer"] : [])];
  if (primary === "rain") return radar ? ["RainViewer", "Open-Meteo"] : ["Open-Meteo"];
  return ["Open-Meteo"];
}

export type MapShareLegend = { title: string; unit: string; gradient?: { color: string; label: string }[];
  swatches?: { color: string; label: string }[]; note?: string };

export async function captureMapBlob(map: Map): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = map.getCanvas();
    const timeout = window.setTimeout(() => { map.off("render", capture); reject(new Error("Map render timed out")); }, 5000);
    const capture = () => {
      window.clearTimeout(timeout);
      try {
        // Call toBlob in this render event, before MapLibre clears the WebGL drawing buffer.
        canvas.toBlob((blob) => blob && blob.size > 0 ? resolve(blob) : reject(new Error("Empty map canvas")), "image/png");
      } catch (error) { reject(error); }
    };
    map.once("render", capture);
    map.triggerRepaint();
  });
}

export async function renderMapShareImage({ mapBlob, windCanvas, title, subtitle, legend, time, sourceLine, t }: {
  mapBlob: Blob; windCanvas?: HTMLCanvasElement | null; title: string; subtitle: string; legend: MapShareLegend;
  time: string; sourceLine: string[]; t: T & { locale: Locale };
}): Promise<Blob> {
  const mapImage = await createImageBitmap(mapBlob);
  try {
    const sample = document.createElement("canvas");
    sample.width = sample.height = 32;
    const sampleCtx = sample.getContext("2d")!;
    sampleCtx.drawImage(mapImage, 0, 0, 32, 32);
    const pixels = sampleCtx.getImageData(0, 0, 32, 32).data;
    if (!Array.from({ length: 32 * 32 }, (_, index) => index).some((index) => {
      const offset = index * 4;
      return pixels[offset + 3] > 0 && (pixels[offset] > 8 || pixels[offset + 1] > 8 || pixels[offset + 2] > 8);
    })) throw new Error("Map capture is blank or black");
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d")!;
    await document.fonts.ready;
    const family = getComputedStyle(document.body).fontFamily || "sans-serif";
    ctx.fillStyle = "#f7fbff";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#1e2744";
    ctx.font = `700 48px ${family}`;
    ctx.fillText(t("ฟ้าวันนี้"), 64, 82);
    ctx.font = `700 62px ${family}`;
    ctx.fillText(title, 64, 155, W - 128);
    ctx.fillStyle = "#4a5878";
    ctx.font = `500 32px ${family}`;
    ctx.fillText(subtitle, 64, 201, W - 128);

    const mapY = 232;
    const mapHeight = 800;
    const crop = coverCrop(mapImage.width, mapImage.height, W, mapHeight);
    ctx.drawImage(mapImage, crop.x, crop.y, crop.width, crop.height, 0, mapY, W, mapHeight);
    if (windCanvas?.width && windCanvas.height) {
      const overlayCrop = coverCrop(windCanvas.width, windCanvas.height, W, mapHeight);
      ctx.drawImage(windCanvas, overlayCrop.x, overlayCrop.y, overlayCrop.width, overlayCrop.height, 0, mapY, W, mapHeight);
    }

    ctx.fillStyle = "#f7fbff";
    ctx.fillRect(0, 1032, W, H - 1032);
    ctx.fillStyle = "#1e2744";
    ctx.font = `700 36px ${family}`;
    ctx.fillText(`${legend.title} · ${legend.unit}`, 64, 1093, W - 128);
    const steps = legend.gradient ?? legend.swatches ?? [];
    if (legend.gradient && steps.length) {
      const gradient = ctx.createLinearGradient(64, 0, W - 64, 0);
      steps.forEach((step, index) => gradient.addColorStop(steps.length === 1 ? 0 : index / (steps.length - 1), step.color));
      ctx.fillStyle = gradient;
      ctx.fillRect(64, 1115, W - 128, 18);
      ctx.fillStyle = "#4a5878";
      ctx.font = `500 25px ${family}`;
      ctx.fillText(steps[0].label, 64, 1166);
      ctx.textAlign = "right";
      ctx.fillText(steps.at(-1)!.label, W - 64, 1166);
      ctx.textAlign = "left";
    } else {
      steps.forEach((step, index) => {
        const x = 64 + index * (W - 128) / Math.max(steps.length, 1);
        ctx.fillStyle = step.color;
        ctx.beginPath();
        ctx.arc(x + 11, 1134, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#4a5878";
        ctx.font = `500 23px ${family}`;
        ctx.fillText(step.label, x + 27, 1142, (W - 128) / Math.max(steps.length, 1) - 30);
      });
    }
    if (legend.note) {
      ctx.fillStyle = "#4a5878";
      ctx.font = `500 25px ${family}`;
      ctx.fillText(legend.note, 64, 1200, W - 128);
    }
    ctx.fillStyle = "#1e2744";
    ctx.font = `600 29px ${family}`;
    ctx.fillText(t("ข้อมูล ณ {time}", { time }), 64, 1245, W - 128);
    ctx.fillStyle = "#4a5878";
    ctx.font = `500 24px ${family}`;
    const source = `${t("ที่มา")}: ${sourceLine.join(" · ")}`;
    wrapText(source, W - 128, (value) => ctx.measureText(value).width, t.locale).slice(0, 2)
      .forEach((line, index) => ctx.fillText(line, 64, 1280 + index * 27));
    ctx.fillText("© OpenFreeMap © OpenStreetMap", 64, 1336);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Map image export failed")), "image/png"));
  } finally {
    mapImage.close();
  }
}
