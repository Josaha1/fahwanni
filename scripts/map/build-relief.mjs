// Builds both matte relief plates: DEM tiles → smoothed 16-bit heightmap → Blender → WebP.
//   node scripts/map/build-relief.mjs [--width 1024] [--samples 32] [--smooth 1.5] [--only light|dark]
// Blender path: $BLENDER, else ~/Applications/Blender.app or /Applications/Blender.app.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = fileURLToPath(new URL("../..", import.meta.url));
const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const BUDGET = 220 * 1024;
const only = arg("only", undefined);
if (only && !["light", "dark"].includes(only)) throw new Error("--only must be light or dark");
const themes = only ? [only] : ["light", "dark"];
const cache = join(root, ".cache/map");
const raw = join(cache, "heightmap.png");
const smooth = join(cache, "heightmap-smooth.png");

const blender = [process.env.BLENDER, join(homedir(), "Applications/Blender.app/Contents/MacOS/Blender"), "/Applications/Blender.app/Contents/MacOS/Blender"]
  .find((path) => path && existsSync(path));
if (!blender) throw new Error("Blender not found: set BLENDER or install to ~/Applications/Blender.app");

mkdirSync(cache, { recursive: true });
if (!existsSync(raw)) execFileSync("node", [join(root, "scripts/map/stitch-dem.mjs"), "--out", raw], { stdio: "inherit" });
await sharp(raw).blur(Number(arg("smooth", "1.5"))).toColourspace("grey16").png().toFile(smooth);

mkdirSync(join(root, "public/map"), { recursive: true });
let over = 0;
for (const theme of themes) {
  const render = join(cache, `relief-${theme}.png`);
  const out = join(root, `public/map/relief-${theme}.webp`);
  execFileSync(blender, ["-b", "-P", join(root, "scripts/blender/relief-terrain.py"), "--",
    "--heightmap", smooth, "--out", render, "--theme", theme,
    "--width", arg("width", "1024"), "--samples", arg("samples", "32")],
  { stdio: ["ignore", "ignore", "inherit"] });

  let quality = 80;
  for (;;) {
    await sharp(render).webp({ quality, alphaQuality: 70, effort: 6 }).toFile(out);
    if (statSync(out).size <= BUDGET || quality <= 40) break;
    quality -= 10;
  }
  const { width, height } = await sharp(out).metadata();
  const bytes = statSync(out).size;
  if (bytes > BUDGET) over++;
  console.log(`relief-${theme}.webp: ${width}×${height}, ${(bytes / 1024).toFixed(1)} KB (q${quality})${bytes > BUDGET ? " OVER BUDGET" : ""}`);
}
if (over) process.exit(1);
