import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { DAM_REGISTRY } from "../../src/lib/dams/registry.ts";
import { provinces } from "../../src/lib/provinces.ts";
import { buildClimatology, chooseSnap } from "./climatology.mjs";
import { upstreamDamsOf } from "./upstream.mjs";

const root = fileURLToPath(new URL("../..", import.meta.url));
const output = join(root, "public/data/river-points.json");
const cacheDir = join(root, ".cache/rivers");
const source = "GloFAS v4 via Open-Meteo Flood API (CC BY 4.0)";
const years = [2011, 2025];
const provinceIds = new Set(provinces.map((province) => province.id));
const damIds = new Set(DAM_REGISTRY.map((dam) => dam.id));

// Province ids match src/lib/provinces.ts; dam ids match src/lib/dams/registry.ts.
// Dropped after the 2026-09-29 eye check (GloFAS simulates generic reservoir rules, not real gate operations):
// ping-tak (Bhumibol), nan-phitsanulok (Sirikit), pasak-saraburi (Pa Sak), maeklong-ratchaburi
// (Srinagarind/Vajiralongkorn: model 4,415 m³/s while the dams released ~23) and bangpakong-prachinburi
// (Khun Dan/Naruebodindra; model 2.4× its own 2011 value). Points right below big dams mislead.
const points = [
  { id: "ping-chiangmai", river: "Ping", nameTh: "ปิง เชียงใหม่", nameEn: "Ping River at Chiang Mai", provinceId: "chiang-mai", lat: 18.79, lon: 99.00, downstreamOfDam: null },
  { id: "wang-lampang", river: "Wang", nameTh: "วัง ลำปาง", nameEn: "Wang River at Lampang", provinceId: "lampang", lat: 18.29, lon: 99.49, downstreamOfDam: null },
  { id: "yom-sukhothai", river: "Yom", nameTh: "ยม สุโขทัย", nameEn: "Yom River at Sukhothai", provinceId: "sukhothai", lat: 17.01, lon: 99.82, downstreamOfDam: null },
  { id: "chaophraya-nakhonsawan", river: "Chao Phraya", nameTh: "เจ้าพระยา นครสวรรค์", nameEn: "Chao Phraya River at Nakhon Sawan", provinceId: "nakhon-sawan", lat: 15.70, lon: 100.12, downstreamOfDam: "200101" },
  { id: "chaophraya-chainat", river: "Chao Phraya", nameTh: "เจ้าพระยา ชัยนาท", nameEn: "Chao Phraya River at Chai Nat", provinceId: "chai-nat", lat: 15.16, lon: 100.18, downstreamOfDam: "200101" },
  { id: "chaophraya-ayutthaya", river: "Chao Phraya", nameTh: "เจ้าพระยา พระนครศรีอยุธยา", nameEn: "Chao Phraya River at Ayutthaya", provinceId: "phra-nakhon-si-ayutthaya", lat: 14.35, lon: 100.58, downstreamOfDam: "200101" },
  { id: "mekong-nongkhai", river: "Mekong", nameTh: "โขง หนองคาย", nameEn: "Mekong River at Nong Khai", provinceId: "nong-khai", lat: 17.88, lon: 102.74, downstreamOfDam: null },
  { id: "chi-yasothon", river: "Chi", nameTh: "ชี ยโสธร", nameEn: "Chi River at Yasothon", provinceId: "yasothon", lat: 15.79, lon: 104.15, downstreamOfDam: null },
  { id: "mun-ubon", river: "Mun", nameTh: "มูล อุบลราชธานี", nameEn: "Mun River at Ubon Ratchathani", provinceId: "ubon-ratchathani", lat: 15.23, lon: 104.86, downstreamOfDam: null },
  { id: "tapi-suratthani", river: "Tapi", nameTh: "ตาปี สุราษฎร์ธานี", nameEn: "Tapi River at Surat Thani", provinceId: "surat-thani", lat: 9.13, lon: 99.33, downstreamOfDam: null },
  { id: "pattani-yala", river: "Pattani", nameTh: "ปัตตานี ยะลา", nameEn: "Pattani River at Yala", provinceId: "yala", lat: 6.55, lon: 101.28, downstreamOfDam: null },
];

function typicalFlow(doy) {
  const values = Object.values(doy ?? {}).map((band) => band?.p50).filter(Number.isFinite).sort((a, b) => a - b);
  return values.length ? values[Math.floor(values.length / 2)] : NaN;
}

function validate(data) {
  const errors = [];
  const fail = (where, message) => errors.push(`${where}: ${message}`);
  if (!data || !Array.isArray(data.points)) return ["root: points must be an array"];
  if (Number.isNaN(Date.parse(data.generatedAt))) fail("root", "invalid generatedAt");
  if (data.source !== source) fail("root", "invalid source");
  if (JSON.stringify(data.years) !== JSON.stringify(years)) fail("root", "years must be [2011,2025]");
  if (data.points.length < 10) fail("root", "at least 10 points required");
  const ids = new Set();
  for (const point of data.points) {
    const where = point?.id || "unknown point";
    if (ids.has(point?.id)) fail(where, "duplicate id");
    ids.add(point?.id);
    for (const key of ["id", "nameTh", "nameEn", "river", "provinceId"]) {
      if (typeof point?.[key] !== "string" || !point[key].trim()) fail(where, `missing ${key}`);
    }
    if (!provinceIds.has(point.provinceId)) fail(where, `unknown provinceId ${point.provinceId}`);
    for (const key of ["lat", "lon", "snappedLat", "snappedLon", "meanDischarge"]) {
      if (!Number.isFinite(point?.[key])) fail(where, `invalid ${key}`);
    }
    if (point.downstreamOfDam != null && !damIds.has(point.downstreamOfDam)) fail(where, "unknown downstreamOfDam");
    if (!Array.isArray(point.upstreamDams) || point.upstreamDams.some((dam) => !damIds.has(dam?.damId) || !Number.isFinite(dam?.km))) {
      fail(where, "invalid upstreamDams");
    }
    // A tributary cell shows up as a tiny typical flow; dry-season lows on a real river are fine.
    const typical = typicalFlow(point.doy);
    if (!(typical >= 20)) fail(where, `median seasonal p50 ${typical} < 20 m³/s (tributary cell?)`);
    for (const key of ["p50", "p80"]) {
      if (!Number.isFinite(point.annualMax?.[key]) || point.annualMax[key] < 0) fail(where, `invalid annualMax.${key}`);
    }
    for (let day = 1; day <= 366; day++) {
      const band = point.doy?.[day];
      if (!["p25", "p50", "p75", "p90"].every((key) => Number.isFinite(band?.[key]) && band[key] >= 0)) {
        fail(where, `invalid doy ${day}`);
      } else if (band.p25 > band.p50 || band.p50 > band.p75 || band.p75 > band.p90) {
        fail(where, `unordered doy ${day}`);
      }
      const value = point.value2554?.[day];
      if (day === 60) {
        if (value != null) fail(where, "value2554 day 60 must be null (no February 29 in 2011)");
      } else if (!Number.isFinite(value) || value < 0) fail(where, `invalid value2554 day ${day}`);
    }
  }
  return errors;
}

const args = process.argv.slice(2);
const check = args.includes("--check");
const maxIndex = args.indexOf("--max-requests");
const allowed = new Set();
if (check) allowed.add(args.indexOf("--check"));
if (maxIndex >= 0) { allowed.add(maxIndex); allowed.add(maxIndex + 1); }
if (args.some((_, index) => !allowed.has(index)) ||
    (maxIndex >= 0 && (!/^\d+$/.test(args[maxIndex + 1] || "") || Number(args[maxIndex + 1]) < 1)) ||
    args.filter((arg) => arg === "--check").length > 1 || args.filter((arg) => arg === "--max-requests").length > 1) {
  throw new Error("Usage: node scripts/rivers/build-points.mjs [--check] [--max-requests N]");
}
const maxRequests = maxIndex < 0 ? 300 : Number(args[maxIndex + 1]);
let requests = 0;
let lastRequest = 0;

async function getFlood(lat, lon, start, end) {
  const url = new URL("https://flood-api.open-meteo.com/v1/flood");
  url.searchParams.set("latitude", Array.isArray(lat) ? lat.join(",") : String(lat));
  url.searchParams.set("longitude", Array.isArray(lon) ? lon.join(",") : String(lon));
  url.searchParams.set("daily", "river_discharge");
  url.searchParams.set("start_date", start);
  url.searchParams.set("end_date", end);
  const key = createHash("sha256").update(url.toString()).digest("hex");
  const file = join(cacheDir, `${key}.json`);
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  if (requests >= maxRequests) throw new Error(`Request limit ${maxRequests} reached; rerun with --max-requests N after reviewing quota`);
  const delay = Math.max(0, 400 - (Date.now() - lastRequest));
  if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
  lastRequest = Date.now();
  requests++;
  const response = await fetch(url);
  if (response.status === 429) throw new Error(`Open-Meteo returned 429 after ${requests} requests. Stop and retry later; cached responses are preserved.`);
  if (!response.ok) throw new Error(`Open-Meteo HTTP ${response.status}: ${await response.text()}`);
  const data = await response.json();
  if (data.error) throw new Error(`Open-Meteo: ${data.reason || "unknown error"}`);
  await mkdir(cacheDir, { recursive: true });
  await writeFile(file, JSON.stringify(data) + "\n");
  return data;
}

function dailyRows(data, label) {
  const days = data?.daily?.time;
  const values = data?.daily?.river_discharge_mean ?? data?.daily?.river_discharge;
  if (!Array.isArray(days) || !Array.isArray(values) || days.length !== values.length || !days.length) {
    throw new Error(`${label}: missing daily river discharge or mismatched dates`);
  }
  return days.map((date, index) => ({ date, value: values[index] }));
}

async function build() {
  const routes = JSON.parse(await readFile(join(root, "public/data/dam-paths.geojson"), "utf8")).features
    .map((feature) => ({ damId: feature.properties.damId, coordinates: feature.geometry.coordinates }));
  const built = [];
  for (const point of points) {
    const cells = [];
    for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) {
      cells.push({ lat: Number((point.lat + y * 0.05).toFixed(4)), lon: Number((point.lon + x * 0.05).toFixed(4)) });
    }
    const snapData = await getFlood(cells.map((cell) => cell.lat), cells.map((cell) => cell.lon), "2020-09-01", "2020-09-30");
    if (!Array.isArray(snapData) || snapData.length !== cells.length) throw new Error(`${point.id}: expected 25 snap responses`);
    const snap = chooseSnap(cells.map((cell, index) => {
      const values = dailyRows(snapData[index], `${point.id} snap cell ${index}`).map((row) => row.value)
        .filter((value) => Number.isFinite(value) && value >= 0);
      return { ...cell, meanDischarge: values.length ? values.reduce((a, b) => a + b, 0) / values.length : NaN };
    }));
    const history = [];
    for (let year = years[0]; year <= years[1]; year++) {
      const data = await getFlood(snap.lat, snap.lon, `${year}-01-01`, `${year}-12-31`);
      const rows = dailyRows(data, `${point.id} ${year}`);
      const expected = (new Date(Date.UTC(year + 1, 0, 1)) - new Date(Date.UTC(year, 0, 1))) / 86400000;
      if (rows.length !== expected || rows[0].date !== `${year}-01-01` || rows.at(-1).date !== `${year}-12-31`) {
        throw new Error(`${point.id} ${year}: incomplete daily history`);
      }
      const leap = expected === 366;
      history.push({ year, values: rows.map((row, index) => ({
        // Align the same calendar date across leap and non-leap years.
        doy: index + 1 + (!leap && index >= 59 ? 1 : 0), value: row.value,
      })) });
    }
    const climatology = buildClimatology(history);
    if (typicalFlow(climatology.doy) < 20) {
      console.warn(`${point.id}: dropped because its typical flow is below 20 m³/s (tributary cell?)`);
      continue;
    }
    const upstreamDams = upstreamDamsOf({ ...point, snappedLat: snap.lat, snappedLon: snap.lon }, routes);
    built.push({ ...point, snappedLat: snap.lat, snappedLon: snap.lon, upstreamDams,
      meanDischarge: Math.round(snap.meanDischarge * 10) / 10, ...climatology,
      value2554: { ...climatology.value2554, 60: null } });
    console.log(`${point.id}: ${snap.lat}, ${snap.lon}; mean ${snap.meanDischarge.toFixed(1)} m³/s`);
  }
  const data = { generatedAt: new Date().toISOString(), source, years, points: built };
  const errors = validate(data);
  if (errors.length) throw new Error(`Generated data failed validation:\n${errors.join("\n")}`);
  await mkdir(join(root, "public/data"), { recursive: true });
  await writeFile(output, JSON.stringify(data) + "\n");
  console.log(`Wrote ${built.length} points to ${output}; ${requests} API requests`);
}

try {
  if (check) {
    const data = JSON.parse(await readFile(output, "utf8"));
    const errors = validate(data);
    if (errors.length) throw new Error(errors.join("\n"));
    console.log(`Checked ${data.points.length} river points: schema and typical flow ≥ 20 m³/s`);
  } else {
    await build();
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
