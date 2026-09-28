// Hindcast spike for the radar nowcast (docs/plans/radar-nowcast.md, task 2).
// Uses live RainViewer frames over Thailand (z5 tiles x24–25, y14–15 = 90–112.5°E, 0–21.9°N):
// estimate motion from t-90 → t-60, advect t-60 to +30 / +60, score against the real t-30 / t0,
// and compare with persistence (assume rain stays where it was at t-60).
//   node scripts/nowcast-spike.mts            (newest window)
//   OFFSET=30 node scripts/nowcast-spike.mts  (window shifted 30 min earlier; RainViewer keeps ~2 h)
import sharp from "sharp";
import { advect } from "../src/lib/nowcast/advect.ts";
import { imageToLevels, rainFraction, type Levels } from "../src/lib/nowcast/intensity.ts";
import { downsample, estimateMotion, motionPerMinute } from "../src/lib/nowcast/motion.ts";
import { scoreBinary } from "../src/lib/nowcast/score.ts";

const Z = 5, X0 = 24, Y0 = 14, SIZE = 512;

type Frame = { time: number; path: string };
const manifest = await (await fetch("https://api.rainviewer.com/public/weather-maps.json")).json() as { host: string; radar: { past: Frame[] } };
const past = manifest.radar.past;

async function frameLevels(frame: Frame): Promise<Levels> {
  const tiles = await Promise.all([[0, 0], [1, 0], [0, 1], [1, 1]].map(async ([dx, dy]) => {
    const url = `${manifest.host}${frame.path}/256/${Z}/${X0 + dx}/${Y0 + dy}/2/1_1.png`;
    const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
    return { input: await sharp(buf).ensureAlpha().png().toBuffer(), left: dx * 256, top: dy * 256 };
  }));
  const { data, info } = await sharp({ create: { width: SIZE, height: SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(tiles).raw().toBuffer({ resolveWithObject: true });
  return imageToLevels({ data, width: info.width, height: info.height });
}

/** Frame whose time is closest to `minutesBefore` the newest. */
function pick(minutesBefore: number): Frame {
  const target = past.at(-1)!.time - (minutesBefore + Number(process.env.OFFSET ?? 0)) * 60;
  return past.reduce((a, b) => (Math.abs(b.time - target) < Math.abs(a.time - target) ? b : a));
}

const [f90, f60, f30, f0] = [90, 60, 30, 0].map(pick);
const [l90, l60, l30, l0] = await Promise.all([f90, f60, f30, f0].map(frameLevels));
const minutes = (a: Frame, b: Frame) => (b.time - a.time) / 60;

const coverage = rainFraction(l60);
const a = downsample(l90, SIZE, SIZE, 2), b = downsample(l60, SIZE, SIZE, 2);
const t0 = performance.now();
const m = estimateMotion(a.levels, b.levels, a.w, a.h);
const matchMs = performance.now() - t0;
const v = motionPerMinute({ ...m, vx: m.vx * 2, vy: m.vy * 2 }, minutes(f90, f60)); // full-res px/min
const kmPerPx = (40075 * Math.cos((11 * Math.PI) / 180)) / (256 * 2 ** Z);

console.log(`frames: ${[f90, f60, f30, f0].map((f) => new Date(f.time * 1000).toISOString().slice(11, 16)).join(" → ")} UTC`);
console.log(`rain coverage at t-60: ${(coverage * 100).toFixed(1)} %`);
console.log(`motion: ${v.vx.toFixed(3)}, ${v.vy.toFixed(3)} px/min from ${m.blocks} blocks = ${(Math.hypot(v.vx, v.vy) * kmPerPx * 60).toFixed(0)} km/h (block matching ${matchMs.toFixed(0)} ms)`);

const rows: string[] = [];
let pass: boolean | undefined;
for (const [lead, obs, fObs] of [[30, l30, f30], [60, l0, f0]] as const) {
  const tau = minutes(f60, fObs);
  const adv = scoreBinary(advect(l60, SIZE, SIZE, v.vx, v.vy, tau), obs);
  const per = scoreBinary(l60, obs);
  rows.push(`+${lead} min (τ=${tau}) advection CSI ${adv.csi.toFixed(3)} POD ${adv.pod.toFixed(3)} FAR ${adv.far.toFixed(3)} | persistence CSI ${per.csi.toFixed(3)} POD ${per.pod.toFixed(3)} FAR ${per.far.toFixed(3)}`);
  if (lead === 30) pass = adv.csi >= per.csi;
}
console.log(rows.join("\n"));
if (coverage < 0.03) { console.log("RESULT: INCONCLUSIVE (rain coverage < 3 %) — rerun when it is raining more"); process.exit(0); }
console.log(`RESULT: ${pass ? "PASS" : "FAIL"} (advection ${pass ? "≥" : "<"} persistence at +30 min)`);
process.exit(pass ? 0 : 1);
