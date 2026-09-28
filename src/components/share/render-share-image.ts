"use client";

import type { Locale, T } from "@/i18n/core";
import type { AirSnapshot } from "@/lib/air";
import { animSheet } from "@/lib/condition";
import type { Place } from "@/lib/place";
import { buildShareText } from "@/lib/share";
import type { WeatherSnapshot } from "@/lib/weather/types";
import { wrapText } from "@/lib/wrap-text";

const W = 1080;
const H = 1350;

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/**
 * 1080×1350 (4:5, fits LINE/Instagram) summary card: place, big temperature, Blender icon,
 * today's range, PM2.5 and top advice. Same text as the plain share, laid out as an image.
 */
export async function renderShareImage(snapshot: WeatherSnapshot, air: AirSnapshot | undefined, place: Place, t: T & { locale: Locale }): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  // next/font gives the page font a generated family name; reuse it so Thai renders nicely.
  const family = getComputedStyle(document.body).fontFamily || "sans-serif";
  await document.fonts.ready;

  const night = snapshot.isDaytime === false;
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, night ? "#1B2340" : "#BFE0FF");
  bg.addColorStop(1, night ? "#2C3A63" : "#F7FBFF");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  const ink = night ? "#EAF1FF" : "#1E2744";
  const soft = night ? "#B8C4E6" : "#4A5878";

  const [title, main, ...rest] = buildShareText(snapshot, air, place, t.locale, t).split("\n");

  ctx.fillStyle = soft;
  ctx.font = `600 50px ${family}`;
  ctx.fillText(title, 80, 140);

  const sheet = await loadImage(animSheet(snapshot.conditionType, snapshot.isDaytime));
  if (sheet) {
    ctx.imageSmoothingQuality = "high";
    // Top-right, above the text block so falling rain never overlaps the words.
    ctx.drawImage(sheet, 0, 0, 128, 128, W - 60 - 320, 150, 320, 320);
  }

  ctx.fillStyle = ink;
  ctx.font = `700 280px ${family}`;
  ctx.fillText(snapshot.tempC === undefined ? "—" : `${Math.round(snapshot.tempC)}°`, 64, 440);

  let y = 590;
  ctx.font = `700 64px ${family}`;
  for (const line of wrapText(main.replace(/^\d+°\s*/, ""), W - 160, (s) => ctx.measureText(s).width, t.locale)) {
    ctx.fillText(line, 80, y);
    y += 84;
  }

  y += 50;
  ctx.fillStyle = soft;
  for (const raw of rest) {
    const bullet = raw.startsWith("•");
    ctx.font = `${bullet ? 500 : 600} ${bullet ? 50 : 56}px ${family}`;
    for (const line of wrapText(raw, W - 160, (s) => ctx.measureText(s).width, t.locale)) {
      if (y > H - 170) break;
      ctx.fillText(line, 80, y);
      y += bullet ? 68 : 74;
    }
    y += bullet ? 16 : 22;
  }

  ctx.fillStyle = soft;
  ctx.font = `500 36px ${family}`;
  ctx.fillText(t("ข้อมูลจาก Google Weather · ฟ้าวันนี้"), 80, H - 80);

  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))), "image/png"));
}
