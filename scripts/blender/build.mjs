// Renders the animated condition icons with headless Blender and writes
// public/anim/<name>.webp — one horizontal sprite sheet of FRAMES × 128 px frames.
//   node scripts/blender/build.mjs [--only rain-day,clear-day] [--engine eevee|cycles] [--samples 32]
// Blender path: $BLENDER, else ~/Applications/Blender.app or /Applications/Blender.app.
// Pattern follows baby-care's scripts/blender/build.mjs.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, statSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = fileURLToPath(new URL("../..", import.meta.url));
const out = join(root, "public/anim");
const FRAMES = 24;
const SIZE = 128;
const BUDGET = 120 * 1024;

const arg = (name) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : undefined; };
const blender = [process.env.BLENDER, join(homedir(), "Applications/Blender.app/Contents/MacOS/Blender"), "/Applications/Blender.app/Contents/MacOS/Blender"]
  .find((path) => path && existsSync(path));
if (!blender) throw new Error("Blender not found: set BLENDER or install to ~/Applications/Blender.app");

const renders = mkdtempSync(join(tmpdir(), "fah-icons-"));
const args = ["-b", "-P", join(root, "scripts/blender/icons.py"), "--", "--out", renders,
  "--size", String(SIZE * 2), "--frames", String(FRAMES), "--engine", arg("engine") ?? "eevee", "--samples", arg("samples") ?? "32"];
if (arg("only")) args.push("--only", arg("only"));
execFileSync(blender, args, { stdio: ["ignore", "ignore", "inherit"] });

mkdirSync(out, { recursive: true });
let over = 0;
for (const name of readdirSync(renders).sort()) {
  const dir = join(renders, name);
  const files = readdirSync(dir).filter((f) => f.endsWith(".png")).sort();
  if (files.length !== FRAMES) throw new Error(`${name}: expected ${FRAMES} frames, got ${files.length}`);
  // Rendered at 2× and downscaled for cleaner edges.
  const frames = await Promise.all(files.map((f) => sharp(join(dir, f)).resize(SIZE, SIZE).png().toBuffer()));
  const target = join(out, `${name}.webp`);
  await sharp({ create: { width: SIZE * FRAMES, height: SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(frames.map((input, i) => ({ input, left: i * SIZE, top: 0 })))
    .webp({ quality: 80, alphaQuality: 85, effort: 6 })
    .toFile(target);
  const bytes = statSync(target).size;
  if (bytes > BUDGET) over++;
  console.log(`${name}: ${SIZE * FRAMES}×${SIZE}, ${(bytes / 1024).toFixed(1)} KB${bytes > BUDGET ? " OVER" : ""}`);
}
rmSync(renders, { recursive: true, force: true });
if (over) { console.error(`${over} sheet(s) over the ${BUDGET / 1024} KB budget`); process.exit(1); }
