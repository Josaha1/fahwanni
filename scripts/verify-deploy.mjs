import { readFile } from "node:fs/promises";

const baseUrl = process.argv[2];
if (!baseUrl) {
  console.error("Usage: node scripts/verify-deploy.mjs <baseUrl>");
  process.exit(1);
}

let base;
try {
  base = new URL(baseUrl);
  if (!['http:', 'https:'].includes(base.protocol)) throw new Error("Expected an HTTP URL");
} catch {
  console.error(`Invalid base URL: ${baseUrl}`);
  process.exit(1);
}

const { version } = JSON.parse(await readFile(new URL("../node_modules/maplibre-gl/package.json", import.meta.url), "utf8"));
const paths = [
  "/",
  "/map",
  "/api/weather?lat=13.75&lon=100.5&lang=th",
  "/api/radar",
  "/api/wind",
  "/api/pm25",
  "/api/storms",
  "/api/quakes",
  "/sw.js",
  "/map/relief-light.webp",
  "/map/relief-dark.webp",
  "/anim/typhoon-calm.webp",
  `/vendor/maplibre/${version}/maplibre-gl-worker.mjs`,
];

const results = await Promise.all(paths.map(async (path) => {
  const started = performance.now();
  try {
    const response = await fetch(new URL(path, base), { cache: "no-store" });
    const bytes = (await response.arrayBuffer()).byteLength;
    const vercelId = response.headers.get("x-vercel-id");
    return { path, status: response.status, bytes, ms: Math.round(performance.now() - started), region: vercelId?.split("::")[0] ?? "" };
  } catch (error) {
    return { path, status: "ERROR", bytes: 0, ms: Math.round(performance.now() - started), region: "", error: String(error) };
  }
}));

console.table(results.map(({ path, status, bytes, ms, region }) => ({ path, status, bytes, ms, region })));
for (const result of results) {
  if (result.path === "/api/wind" && result.status === 503) {
    console.warn("Open-Meteo quota: /api/wind returned 503 on this fresh deploy");
    continue;
  }
  if (typeof result.status !== "number" || result.status < 200 || result.status >= 300) {
    console.error(`${result.path}: ${result.error ?? `HTTP ${result.status}`}`);
    process.exitCode = 1;
  }
}
