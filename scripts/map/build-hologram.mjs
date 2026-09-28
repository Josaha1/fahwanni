// Builds public/map/hologram-terrain.webp: DEM tiles → smoothed 16-bit heightmap → headless
// Blender render (scripts/blender/hologram-terrain.py) → WebP within the map-tab budget.
//   node scripts/map/build-hologram.mjs [--width 1024] [--samples 32] [--smooth 2.5]
// Blender path: $BLENDER, else ~/Applications/Blender.app or /Applications/Blender.app.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = fileURLToPath(new URL("../..", import.meta.url));
const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const BUDGET = 350 * 1024;
const cache = join(root, ".cache/map");
const raw = join(cache, "heightmap.png");
const smooth = join(cache, "heightmap-smooth.png");
const render = join(cache, "hologram.png");
const out = join(root, "public/map/hologram-terrain.webp");

const blender = [process.env.BLENDER, join(homedir(), "Applications/Blender.app/Contents/MacOS/Blender"), "/Applications/Blender.app/Contents/MacOS/Blender"]
  .find((path) => path && existsSync(path));
if (!blender) throw new Error("Blender not found: set BLENDER or install to ~/Applications/Blender.app");

mkdirSync(cache, { recursive: true });
if (!existsSync(raw)) execFileSync("node", [join(root, "scripts/map/stitch-dem.mjs"), "--out", raw], { stdio: "inherit" });

// A light blur turns jagged z6 contours into the flowing lines of a hologram.
await sharp(raw).blur(Number(arg("smooth", "2.5"))).toColourspace("grey16").png().toFile(smooth);

execFileSync(blender, ["-b", "-P", join(root, "scripts/blender/hologram-terrain.py"), "--",
  "--heightmap", smooth, "--out", render, "--width", arg("width", "1024"), "--samples", arg("samples", "32")],
{ stdio: ["ignore", "ignore", "inherit"] });

mkdirSync(join(root, "public/map"), { recursive: true });
let quality = 80;
for (;;) {
  await sharp(render).webp({ quality, alphaQuality: 70, effort: 6 }).toFile(out);
  if (statSync(out).size <= BUDGET || quality <= 40) break;
  quality -= 10;
}
const { width, height } = await sharp(out).metadata();
const bytes = statSync(out).size;
console.log(`hologram-terrain.webp: ${width}×${height}, ${(bytes / 1024).toFixed(1)} KB (q${quality})${bytes > BUDGET ? " OVER BUDGET" : ""}`);
if (bytes > BUDGET) process.exit(1);
