"use client";

import { wrapText } from "@/lib/wrap-text";

/** Uses the same text as the plain share; grow the card rather than cut off a source or date. */
export async function renderSummaryImage(text: string, locale: string): Promise<Blob> {
  await document.fonts.ready;
  const family = getComputedStyle(document.body).fontFamily || "sans-serif";
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  const paragraphs = text.split("\n").map((paragraph, index) => {
    ctx.font = `${index === 0 ? 700 : 500} ${index === 0 ? 64 : 44}px ${family}`;
    return wrapText(paragraph, 920, (line) => ctx.measureText(line).width, locale);
  });
  canvas.height = Math.max(1350, 160 + paragraphs.reduce((height, lines, index) => height + lines.length * (index === 0 ? 84 : 62) + 40, 0));
  ctx.fillStyle = "#f7fbff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  let y = 100;
  paragraphs.forEach((lines, index) => {
    ctx.fillStyle = index === 0 ? "#1e2744" : "#4a5878";
    ctx.font = `${index === 0 ? 700 : 500} ${index === 0 ? 64 : 44}px ${family}`;
    for (const line of lines) {
      ctx.fillText(line, 80, y);
      y += index === 0 ? 84 : 62;
    }
    y += 40;
  });
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("toBlob failed")), "image/png"));
}
