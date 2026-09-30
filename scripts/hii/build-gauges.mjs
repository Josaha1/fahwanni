import { readFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { distanceKm, isFlatline, pickStation, stationsFromCsv, summarizeGaugeCsv } from "./gauges.mjs";

const root = fileURLToPath(new URL("../..", import.meta.url));
const cacheDir = join(root, ".cache/hii");
const output = join(root, "public/data/hii-gauges.json");
const base = "https://tiservice.hii.or.th/opendata/data_catalog/water_level/";
const args = process.argv.slice(2);
const check = args.includes("--check");
const limitIndex = args.indexOf("--max-requests");
const allowed = new Set();
if (check) allowed.add(args.indexOf("--check"));
if (limitIndex >= 0) { allowed.add(limitIndex); allowed.add(limitIndex + 1); }
if (args.some((_, index) => !allowed.has(index)) || args.filter((arg) => arg === "--check").length > 1 ||
    args.filter((arg) => arg === "--max-requests").length > 1 ||
    (limitIndex >= 0 && (!/^\d+$/.test(args[limitIndex + 1] ?? "") || Number(args[limitIndex + 1]) < 1))) {
  throw new Error("Usage: node scripts/hii/build-gauges.mjs [--check] [--max-requests N]");
}
const maxRequests = limitIndex < 0 ? 60 : Number(args[limitIndex + 1]);
let requests = 0, lastRequest = 0;

async function get(path) {
  const cached = join(cacheDir, (path || "root").replace(/\/$/, "/_index").replaceAll("/", "_"));
  if (path.endsWith(".csv")) {
    try { return await readFile(cached, "utf8"); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
  }
  if (requests >= maxRequests) throw new Error(`HII request limit ${maxRequests} reached`);
  const delay = Math.max(0, 500 - (Date.now() - lastRequest));
  if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
  requests++; lastRequest = Date.now();
  const response = await fetch(new URL(path, base));
  if (!response.ok) throw new Error(`HII ${path}: HTTP ${response.status}`);
  const body = await response.text();
  await mkdir(cacheDir, { recursive: true });
  await writeFile(cached, body);
  return body;
}

function links(html, pattern) {
  return [...html.matchAll(/href=["']([^"']+)["']/gi)].map((match) => decodeURIComponent(match[1]))
    .filter((href) => pattern.test(href)).map((href) => href.match(/([^/]+\/?$)/)[1]);
}

async function latestMonth() {
  const years = links(await get(""), /(?:^|\/)\d{4}\/$/).map((href) => Number(href.replace("/", ""))).sort((a, b) => b - a);
  if (!years.length) throw new Error("HII listing contains no year directories");
  for (const year of years) {
    const months = links(await get(`${year}/`), /(?:^|\/)\d{6}\/$/).map((href) => href.replace("/", "")).sort().reverse();
    for (const folder of months) {
      const files = links(await get(`${year}/${folder}/`), /(?:^|\/)[^/]+\.csv$/i);
      if (files.length) return { month: `${folder.slice(0, 4)}-${folder.slice(4)}`, folder: `${year}/${folder}`, files };
    }
  }
  throw new Error("HII has no monthly station CSV files");
}

function validate(data, pointIds) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(data.month) || !Number.isFinite(Date.parse(data.generatedAt)) ||
      data.source !== "สถาบันสารสนเทศทรัพยากรน้ำ (HII) open data · CC BY-NC" || !data.gauges || typeof data.gauges !== "object") {
    throw new Error("Invalid HII gauge file metadata");
  }
  for (const [id, gauge] of Object.entries(data.gauges)) {
    if (!pointIds.has(id) || !gauge.code || !gauge.name || !Number.isFinite(gauge.lat) || !Number.isFinite(gauge.lon) ||
        !gauge.levelMsl || ![gauge.levelMsl.min, gauge.levelMsl.mean, gauge.levelMsl.max].every(Number.isFinite) ||
        gauge.levelMsl.min > gauge.levelMsl.mean || gauge.levelMsl.mean > gauge.levelMsl.max ||
        (gauge.bankMsl != null && !Number.isFinite(gauge.bankMsl)) ||
        !gauge.days || !/^\d{4}-\d{2}-\d{2}$/.test(gauge.days.from) || !/^\d{4}-\d{2}-\d{2}$/.test(gauge.days.to) ||
        !gauge.days.from.startsWith(data.month) || !gauge.days.to.startsWith(data.month) ||
        gauge.days.from > gauge.days.to || !Number.isInteger(gauge.days.count) || gauge.days.count < 1) throw new Error(`Invalid HII gauge: ${id}`);
  }
}

const points = [
  ...JSON.parse(await readFile(join(root, "public/data/river-points.json"), "utf8")).points,
  // Observed points pin their station; see docs/plans/observed-points.md.
  ...JSON.parse(await readFile(join(root, "public/data/observed-points.json"), "utf8")).points,
];
const ids = new Set(points.map((point) => point.id));
if (check) {
  validate(JSON.parse(await readFile(output, "utf8")), ids);
  console.log(`Valid HII gauges: ${output}`);
} else {
  const metadata = stationsFromCsv(await get("0all_stn_metadata.csv"));
  console.log(`HII metadata headers: ${metadata.header.join(", ")}`);
  const { month, folder, files } = await latestMonth();
  console.log(`HII latest month with files: ${month}`);
  const gauges = {};
  for (const point of points) {
    const available = metadata.stations.filter((item) => files.some((file) => file.toLowerCase() === `${item.code}.csv`.toLowerCase()));
    const station = pickStation(point, available);
    if (!station) { console.log(`${point.id}: ${point.gauge ? `pinned station ${point.gauge} has no file this month` : "no station within 10 km"}`); continue; }
    const filename = files.find((file) => file.toLowerCase() === `${station.code}.csv`.toLowerCase());
    const summary = summarizeGaugeCsv(await get(`${folder}/${filename}`), month);
    console.log(`${station.code} headers: ${summary.header.join(", ")}`);
    if (isFlatline(summary.levelMsl, summary.days)) { console.log(`${point.id}: ${station.code} reports a flat line this month — skipped`); continue; }
    gauges[point.id] = { code: station.code, name: station.name, lat: station.lat, lon: station.lon,
      km: Math.round(distanceKm(point, station) * 10) / 10, levelMsl: summary.levelMsl,
      bankMsl: summary.bankMsl ?? station.bankMsl, days: summary.days };
  }
  const data = { generatedAt: new Date().toISOString(), source: "สถาบันสารสนเทศทรัพยากรน้ำ (HII) open data · CC BY-NC", month, gauges };
  validate(data, ids);
  await writeFile(output, `${JSON.stringify(data, null, 2)}\n`);
  console.log(`Wrote ${output} (${Object.keys(gauges).length} gauges, ${requests} requests)`);
}
