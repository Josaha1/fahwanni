// Stitches AWS Terrarium elevation tiles into one 16-bit heightmap for the Blender relief plates.
//   node scripts/map/stitch-dem.mjs [--out .cache/map/heightmap.png]
// Tile-aligned area z6 x48–51, y27–31 = 90–112.5°E, 0–27.06°N (Web Mercator, so the stitched
// image can be placed on the map by its corners without reprojection).
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

export const DEM = { z: 6, x0: 48, x1: 51, y0: 27, y1: 31 };
const root = fileURLToPath(new URL("../..", import.meta.url));
const arg = (name) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : undefined; };
const out = arg("out") ?? join(root, ".cache/map/heightmap.png");
const MAX_M = 6000; // highest peaks in the area stay below this

const cols = DEM.x1 - DEM.x0 + 1, rows = DEM.y1 - DEM.y0 + 1;
const W = cols * 256, H = rows * 256;
const height = new Uint16Array(W * H);
let maxSeen = 0, landPx = 0;

for (let ty = DEM.y0; ty <= DEM.y1; ty++) {
  for (let tx = DEM.x0; tx <= DEM.x1; tx++) {
    const url = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${DEM.z}/${tx}/${ty}.png`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url}: ${res.status}`);
    const { data } = await sharp(Buffer.from(await res.arrayBuffer())).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    for (let y = 0; y < 256; y++) {
      for (let x = 0; x < 256; x++) {
        const i = (y * 256 + x) * 3;
        // Terrarium encoding: metres = R*256 + G + B/256 − 32768; sea floor is clipped to 0.
        const m = Math.max(0, data[i] * 256 + data[i + 1] + data[i + 2] / 256 - 32768);
        if (m > 0) landPx++;
        maxSeen = Math.max(maxSeen, m);
        height[((ty - DEM.y0) * 256 + y) * W + (tx - DEM.x0) * 256 + x] = Math.round(Math.min(m, MAX_M) / MAX_M * 65535);
      }
    }
  }
}

mkdirSync(dirname(out), { recursive: true });
// Pass the Uint16Array itself: sharp reads a typed array as 16-bit ("ushort") samples; a Buffer
// would be read as 8-bit and scramble the bytes.
await sharp(height, { raw: { width: W, height: H, channels: 1 } })
  .toColourspace("grey16").png({ compressionLevel: 9 }).toFile(out);
const lat = (y) => (Math.atan(Math.sinh(Math.PI - (2 * Math.PI * y) / 2 ** DEM.z)) * 180) / Math.PI;
console.log(JSON.stringify({ out, width: W, height: H, maxMetres: Math.round(maxSeen), landShare: +(landPx / (W * H)).toFixed(3),
  bbox: [DEM.x0 / 2 ** DEM.z * 360 - 180, lat(DEM.y1 + 1), (DEM.x1 + 1) / 2 ** DEM.z * 360 - 180, lat(DEM.y0)] }));
