// Builds the home-screen icons from one Blender still (scripts/blender/app-icon.py):
//   node scripts/app-icon/build.mjs [--samples 64] [--preview]
// → public/icon-192.png, icon-512.png (rounded tile), icon-maskable-512.png (full bleed, subject
//   inside the 80 % safe circle), apple-touch-icon.png 180 (full bleed, iOS masks it), and
//   src/app/favicon.ico (16/32/48). --preview also writes .cache/app-icon/preview.png (sizes side by side).
// Blender path: $BLENDER, else ~/Applications/Blender.app or /Applications/Blender.app.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = fileURLToPath(new URL("../..", import.meta.url));
const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const cache = join(root, ".cache/app-icon");
const subjectPath = join(cache, "subject.png");

const blender = [process.env.BLENDER, join(homedir(), "Applications/Blender.app/Contents/MacOS/Blender"), "/Applications/Blender.app/Contents/MacOS/Blender"]
  .find((path) => path && existsSync(path));
if (!blender) throw new Error("Blender not found: set BLENDER or install to ~/Applications/Blender.app");

mkdirSync(cache, { recursive: true });
execFileSync(blender, ["-b", "-P", join(root, "scripts/blender/app-icon.py"), "--", "--out", subjectPath, "--size", "1024", "--samples", arg("samples", "64")],
  { stdio: ["ignore", "ignore", "inherit"] });

// Sky tile: light at the top-left (where the day starts) to deep blue at the bottom, with a soft
// warm glow behind the sun. Colours stay light enough that the white cloud still has contrast.
function background(size, radius) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="sky" x1="0.2" y1="0" x2="0.8" y2="1">
      <stop offset="0" stop-color="#9FD0FF"/><stop offset="0.55" stop-color="#5A9CF8"/><stop offset="1" stop-color="#2F63E0"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.66" cy="0.32" r="0.42">
      <stop offset="0" stop-color="#FFE9A8" stop-opacity="0.75"/><stop offset="1" stop-color="#FFE9A8" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="100" height="100" rx="${radius}" fill="url(#sky)"/>
  <rect width="100" height="100" rx="${radius}" fill="url(#glow)"/>
</svg>`);
}

/** Subject scaled to `scale` of the tile, centred, with a soft blue contact shadow under it. */
async function tile(size, { radius, scale, dy = 0 }) {
  const subjectSize = Math.round(size * scale);
  const subject = await sharp(subjectPath).resize(subjectSize, subjectSize).png().toBuffer();
  const alpha = await sharp(subject).extractChannel("alpha").toBuffer();
  const shadow = await sharp({ create: { width: subjectSize, height: subjectSize, channels: 3, background: "#1C3F99" } })
    .joinChannel(await sharp(alpha).linear(0.35, 0).blur(Math.max(1, size * 0.025)).toBuffer()).png().toBuffer();
  const left = Math.round((size - subjectSize) / 2);
  const top = Math.round((size - subjectSize) / 2 + dy * size);
  return sharp(background(size, radius)).resize(size, size)
    .composite([{ input: shadow, left, top: top + Math.round(size * 0.02) }, { input: subject, left, top }])
    .png();
}

const outputs = [
  ["public/icon-512.png", 512, { radius: 22, scale: 0.84, dy: 0.01 }],
  ["public/icon-192.png", 192, { radius: 22, scale: 0.86, dy: 0.01 }],
  // Maskable: the launcher may crop to a circle of 80 % diameter, so keep the subject within ~66 %.
  ["public/icon-maskable-512.png", 512, { radius: 0, scale: 0.66, dy: 0.01 }],
  // iOS adds its own rounded mask and needs an opaque, full-bleed image.
  ["public/apple-touch-icon.png", 180, { radius: 0, scale: 0.8, dy: 0.01 }],
];
for (const [path, size, options] of outputs) {
  const image = await tile(size, options);
  // Rounded tiles keep transparent corners; full-bleed ones must be opaque (iOS shows black otherwise).
  await (options.radius ? image : image.flatten({ background: "#5A9CF8" })).toFile(join(root, path));
  console.log(`${path} ${size}×${size}`);
}

// favicon.ico with PNG entries (supported by every current browser).
const icoSizes = [16, 32, 48];
const pngs = await Promise.all(icoSizes.map(async (size) => (await tile(size, { radius: 22, scale: 0.9 })).toBuffer()));
const header = Buffer.alloc(6 + 16 * pngs.length);
header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(pngs.length, 4);
let offset = header.length;
pngs.forEach((png, i) => {
  const entry = 6 + 16 * i;
  header.writeUInt8(icoSizes[i], entry); header.writeUInt8(icoSizes[i], entry + 1);
  header.writeUInt16LE(1, entry + 4); header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(png.length, entry + 8); header.writeUInt32LE(offset, entry + 12);
  offset += png.length;
});
writeFileSync(join(root, "src/app/favicon.ico"), Buffer.concat([header, ...pngs]));
console.log("src/app/favicon.ico 16/32/48");

if (process.argv.includes("--preview")) {
  // Home-screen check: the icon at 180/96/48/32 on a light and a dark wallpaper.
  const sizes = [180, 96, 48, 32];
  const cells = [];
  let x = 20;
  for (const size of sizes) {
    const png = await (await tile(size, { radius: 22, scale: 0.86, dy: 0.01 })).toBuffer();
    cells.push({ input: png, left: x, top: 20 }, { input: png, left: x, top: 240 });
    x += size + 30;
  }
  await sharp({ create: { width: x, height: 460, channels: 4, background: "#F2F4F8" } })
    .composite([{ input: { create: { width: x, height: 230, channels: 4, background: "#10141F" } }, left: 0, top: 230 }, ...cells])
    .png().toFile(join(cache, "preview.png"));
  console.log(".cache/app-icon/preview.png");
}
