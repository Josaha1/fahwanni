import * as shapefile from "shapefile";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { DAM_REGISTRY } from "../../src/lib/dams/registry.ts";
import { provinces } from "../../src/lib/provinces.ts";
import { alongKm, distanceKm, douglasPeucker, pointToSegmentKm } from "./geo.mjs";

// Builds public/data/dam-paths.geojson and dam-downstream.json from the dam registry (Wikidata / OSM
// coordinates) and HydroRIVERS v10 (CC BY 4.0). Provinces along each route come from src/lib/provinces.ts.
//   node scripts/dams/build-paths.mjs [--hydro .cache/hydro/HydroRIVERS_v10_as_shp/HydroRIVERS_v10_as]
const root = fileURLToPath(new URL("../..", import.meta.url));
const args = process.argv.slice(2);
function option(name, fallback) {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  if (!args[index + 1] || args[index + 1].startsWith("--")) throw new Error(`${name} requires a path`);
  return args[index + 1];
}
const hydro = option("--hydro", join(root, ".cache/hydro/HydroRIVERS_v10_as_shp/HydroRIVERS_v10_as"));
const dams = DAM_REGISTRY;
const targets = dams;

const reaches = new Map();
const source = await shapefile.open(`${hydro}.shp`, `${hydro}.dbf`);
for (;;) {
  const row = await source.read();
  if (row.done) break;
  const coords = row.value.geometry?.coordinates;
  if (row.value.geometry?.type !== "LineString" || !coords?.length) continue;
  const [lon, lat] = coords[0];
  if (lon < 90 || lon > 112 || lat < 3 || lat > 24) continue;
  const properties = row.value.properties;
  const bounds = coords.reduce((box, [x, y]) => [
    Math.min(box[0], x), Math.min(box[1], y), Math.max(box[2], x), Math.max(box[3], y),
  ], [Infinity, Infinity, -Infinity, -Infinity]);
  reaches.set(properties.HYRIV_ID, {
    id: properties.HYRIV_ID,
    next: properties.NEXT_DOWN, upstream: properties.UPLAND_SKM, coords, bounds,
  });
}
console.log(`HydroRIVERS reaches in bbox: ${reaches.size}`);

function snap(point) {
  const nearby = [];
  const longitudeWindow = 5 / (111 * Math.cos(point[1] * Math.PI / 180));
  const latitudeWindow = 5 / 111;
  for (const reach of reaches.values()) {
    const [west, south, east, north] = reach.bounds;
    if (east < point[0] - longitudeWindow || west > point[0] + longitudeWindow ||
        north < point[1] - latitudeWindow || south > point[1] + latitudeWindow) continue;
    let distance = Infinity;
    for (let i = 1; i < reach.coords.length; i++) {
      distance = Math.min(distance, pointToSegmentKm(point, reach.coords[i - 1], reach.coords[i]));
    }
    if (distance <= 5) nearby.push(reach);
  }
  for (const threshold of [200, 20]) {
    const eligible = nearby.filter((reach) => reach.upstream >= threshold);
    if (eligible.length) return eligible.reduce((best, reach) =>
      reach.upstream > best.upstream ? reach : best);
  }
  return null;
}

function trace(start, origin) {
  const path = [origin.point];
  const visited = new Set();
  let id = start;
  let length = 0;
  while (id && reaches.has(id) && !visited.has(id) && length < 700) {
    visited.add(id);
    const reach = reaches.get(id);
    const coords = id === start ? reach.coords.slice(origin.segmentIndex) : reach.coords;
    for (const point of coords) {
      if (path.length && distanceKm(path.at(-1), point) < 0.00001) continue;
      if (path.length) {
        const step = distanceKm(path.at(-1), point);
        if (length + step >= 700) {
          const part = (700 - length) / step;
          path.push([path.at(-1)[0] + (point[0] - path.at(-1)[0]) * part,
            path.at(-1)[1] + (point[1] - path.at(-1)[1]) * part]);
          return { path, km: 700 };
        }
        length += step;
      }
      path.push(point);
    }
    id = reach.next;
  }
  return { path, km: length };
}

const features = [];
const downstream = {};
const missing = [];
const round = (value) => Math.round(value * 10) / 10;
for (const dam of targets) {
  const reach = snap([dam.lon, dam.lat]);
  if (!reach) {
    missing.push(`${dam.id} ${dam.nameTh}`);
    console.warn(`Warning: no path for ${dam.id} ${dam.nameTh}`);
    continue;
  }
  const origin = alongKm([dam.lon, dam.lat], reach.coords);
  const { path, km } = trace(reach.id, origin);
  if (path.length < 2) {
    missing.push(`${dam.id} ${dam.nameTh}`);
    console.warn(`Warning: no path for ${dam.id} ${dam.nameTh}`);
    continue;
  }
  const matches = (items, limit, key) => items.flatMap((item) => {
    const result = alongKm([item.lon, item.lat], path);
    return result.distanceKm <= limit ? [{ [key]: item[key], km: round(result.km) }] : [];
  }).sort((a, b) => a.km - b.km || String(a[key]).localeCompare(String(b[key])));
  // No river stations: no source with published terms (see docs/plans/map-water-v2.md).
  downstream[dam.id] = { km: round(km), provinces: matches(provinces, 15, "id") };
  const coordinates = douglasPeucker(path, 0.003)
    .map((point) => point.map((value) => Math.round(value * 10000) / 10000));
  features.push({ type: "Feature", properties: { damId: dam.id, km: round(km) },
    geometry: { type: "LineString", coordinates } });
}

const output = join(root, "public/data");
await mkdir(output, { recursive: true });
const files = [
  ["dam-paths.geojson", { type: "FeatureCollection", features }],
  ["dam-downstream.json", { generatedAt: new Date().toISOString(),
    source: "HydroRIVERS v10 (CC BY 4.0)", dams: downstream }],
];
let pathsGzip = 0;
for (const [name, data] of files) {
  const content = JSON.stringify(data) + "\n";
  const bytes = Buffer.byteLength(content);
  const gzip = gzipSync(content).length;
  await writeFile(join(output, name), content);
  console.log(`${name}: ${(bytes / 1024).toFixed(1)} KB raw, ${(gzip / 1024).toFixed(1)} KB gzip`);
  if (name === "dam-paths.geojson") pathsGzip = gzip;
}
console.log(`Dams: ${dams.length}; paths: ${features.length}; missing: ${missing.length}${missing.length ? ` (${missing.join(", ")})` : ""}`);
if (pathsGzip > 150 * 1024) process.exitCode = 1;
