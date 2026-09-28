"use client";

import { useEffect, useState } from "react";
import type { RadarFrame } from "@/lib/radar/types";
import { classifyPixel, globalPixel, kmPerPixel, summarizeRadar, type RadarSample, type RadarSummary } from "@/lib/radar/summary";
import { loadTile } from "./radar-tile";

const Z = 6;
const RADIUS_KM = 100;
const STEP = 2; // sample every 2nd pixel (~5 km) — plenty for "where is the rain"

/**
 * Reads the newest radar frame's pixels around a place (same z6 tiles the map already
 * loaded, so usually from the HTTP cache) and summarises where the nearest rain is.
 */
export function useRadarSummary(frame: RadarFrame | undefined, lon: number, lat: number): RadarSummary | null {
  const [summary, setSummary] = useState<RadarSummary | null>(null);

  useEffect(() => {
    if (!frame) return;
    let cancelled = false;
    const center = globalPixel(lon, lat, Z);
    const kmPx = kmPerPixel(lat, Z);
    const radiusPx = Math.ceil(RADIUS_KM / kmPx);
    const x0 = Math.floor((center.x - radiusPx) / 256), x1 = Math.floor((center.x + radiusPx) / 256);
    const y0 = Math.floor((center.y - radiusPx) / 256), y1 = Math.floor((center.y + radiusPx) / 256);
    const tiles: { tx: number; ty: number }[] = [];
    for (let tx = x0; tx <= x1; tx++) for (let ty = y0; ty <= y1; ty++) tiles.push({ tx, ty });

    Promise.all(tiles.map(({ tx, ty }) => loadTile(frame.tileUrl.replace("{z}", String(Z)).replace("{x}", String(tx)).replace("{y}", String(ty)))))
      .then((images) => {
        if (cancelled) return;
        const canvas = document.createElement("canvas");
        canvas.width = (x1 - x0 + 1) * 256;
        canvas.height = (y1 - y0 + 1) * 256;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;
        images.forEach((img, i) => ctx.drawImage(img, (tiles[i].tx - x0) * 256, (tiles[i].ty - y0) * 256));
        const originX = Math.round(center.x - x0 * 256), originY = Math.round(center.y - y0 * 256);
        const { data, width } = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const samples: RadarSample[] = [];
        for (let dy = -radiusPx; dy <= radiusPx; dy += STEP) {
          for (let dx = -radiusPx; dx <= radiusPx; dx += STEP) {
            const px = originX + dx, py = originY + dy;
            if (px < 0 || py < 0 || px >= canvas.width || py >= canvas.height) continue;
            const i = (py * width + px) * 4;
            const { rain, heavy } = classifyPixel(data[i], data[i + 1], data[i + 2], data[i + 3]);
            if (rain) samples.push({ eastKm: dx * kmPx, northKm: -dy * kmPx, rain, heavy });
          }
        }
        setSummary(summarizeRadar(samples, RADIUS_KM));
      })
      .catch(() => { if (!cancelled) setSummary(null); });
    return () => { cancelled = true; };
  }, [frame, lon, lat]);

  return summary;
}
