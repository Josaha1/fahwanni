// One logical 40 px gauge, rasterized at 2x; capacity scaling belongs to icon-size.
import { mkdir, readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const output = new URL("../../public/map/rings/", import.meta.url);
const css = await readFile(new URL("../../src/app/globals.css", import.meta.url), "utf8");
const dark = css.slice(css.indexOf('[data-theme="dark"]'));
const roles = Object.fromEntries(["water", "release", "warn"].map((role) => {
  const color = dark.match(new RegExp(`--${role}:\\s*(#[0-9a-fA-F]{6})`))?.[1];
  if (!color) throw new Error(`Missing dark --${role} token`);
  return [role, color];
}));

function arc(radius, pct, color, width) {
  if (pct <= 0) return "";
  const circumference = 2 * Math.PI * radius;
  return `<circle cx="20" cy="20" r="${radius}" fill="none" stroke="${color}" stroke-width="${width}"
    stroke-dasharray="${circumference * Math.min(pct, 100) / 100} ${circumference}"
    transform="rotate(-90 20 20)"/>`;
}

function gauge(pct, color) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 40 40">
    <circle cx="20" cy="20" r="16" fill="#0f172a" stroke="#334155" stroke-width="4"/>
    ${arc(16, pct, color, 4)}
    ${pct > 100 ? arc(19, pct - 100, color, 1) : ""}
  </svg>`;
}

await mkdir(output, { recursive: true });
for (const [role, color] of Object.entries(roles)) {
  for (let pct = 0; pct <= 120; pct += 5) {
    await sharp(Buffer.from(gauge(pct, color))).png().toFile(fileURLToPath(new URL(`ring-${role}-${pct}.png`, output)));
  }
}
const nodata = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 40 40">
  <defs><pattern id="hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
    <rect width="4" height="4" fill="#475569"/><path d="M0 0V4" stroke="#94a3b8" stroke-width="2"/>
  </pattern><mask id="ring"><circle cx="20" cy="20" r="16" fill="none" stroke="white" stroke-width="4"/></mask></defs>
  <circle cx="20" cy="20" r="16" fill="#0f172a"/>
  <rect width="40" height="40" fill="url(#hatch)" mask="url(#ring)"/>
</svg>`;
await sharp(Buffer.from(nodata)).png().toFile(fileURLToPath(new URL("ring-nodata.png", output)));
const files = await readdir(output);
if (files.length !== 76) throw new Error(`Expected 76 sprites, found ${files.length}`);
console.log("Generated 76 ring sprites (80×80 PNG, pixelRatio 2).");
