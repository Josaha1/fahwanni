// Build-time only, independent of osm-dams.json (which deliberately excludes RID dams).
// node scripts/osm/build-dam-geo.mjs [--dry] [--refresh] [--fixture scripts/osm/fixtures/dam-geo.json] [--out DIR]
// Fixture mode defaults to dry: synthetic coordinates must never become production data.
// Coordinates are [longitude, latitude]; rings retain outer/inner roles. Dimensions are metres.
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DAM_REGISTRY } from "../../src/lib/dams/registry.ts";
import { distanceKm, douglasPeucker, pointToSegmentKm } from "../dams/geo.mjs";

const root = fileURLToPath(new URL("../..", import.meta.url));
export const SOURCE = "© OpenStreetMap contributors (ODbL); Wikidata CC0";
const headers = { "User-Agent": "fahwanni/1.0 (https://fahwanni.vercel.app; build script)" };
const mirrors = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
const same = (a, b) => a[0] === b[0] && a[1] === b[1];
const closed = (ring) => ring.length >= 4 && same(ring[0], ring.at(-1));
const normalize = (name) => name.toLowerCase().replace(/เขื่อน|อ่างเก็บน้ำ|reservoir|dam/gu, "").replace(/[\s\p{P}]/gu, "");
const osmUrl = (element) => `https://www.openstreetmap.org/${element.type}/${element.id}`;
const qid = (value) => /^Q\d+$/.test(value ?? "") ? value : null;

function geometry(points) {
  if (!Array.isArray(points) || points.some((p) => !p || !Number.isFinite(p.lon) || !Number.isFinite(p.lat) || Math.abs(p.lon) > 180 || Math.abs(p.lat) > 90)) return [];
  return points.map(({ lon, lat }) => [lon, lat]);
}

/** Assemble reversed/unordered member ways without closing gaps or dropping islands. */
export function reservoirRings(element) {
  if (element.type === "way") {
    const coordinates = geometry(element.geometry);
    return closed(coordinates) ? [{ role: "outer", coordinates }] : null;
  }
  if (element.type !== "relation" || element.tags?.type !== "multipolygon") return null;
  const rings = [];
  for (const role of ["outer", "inner"]) {
    const members = (element.members ?? []).filter((m) => m.type === "way" && (m.role || "outer") === role);
    const pieces = members.map((m) => geometry(m.geometry));
    if (pieces.some((p) => p.length < 2)) return null;
    while (pieces.length) {
      let ring = pieces.shift();
      while (!same(ring[0], ring.at(-1))) {
        const index = pieces.findIndex((p) => same(ring.at(-1), p[0]) || same(ring.at(-1), p.at(-1)));
        if (index < 0) return null;
        let next = pieces.splice(index, 1)[0];
        if (!same(ring.at(-1), next[0])) next = next.slice().reverse();
        ring = ring.concat(next.slice(1));
      }
      if (!closed(ring)) return null;
      rings.push({ role, coordinates: ring });
    }
  }
  return rings.some((r) => r.role === "outer") ? rings : null;
}

/** A closed ring needs two open simplifications so its start/end cannot collapse together. */
function simplifyRing(ring, tolerance) {
  let pivot = 1, farthest = 0;
  for (let i = 1; i < ring.length - 1; i++) {
    const d = (ring[i][0] - ring[0][0]) ** 2 + (ring[i][1] - ring[0][1]) ** 2;
    if (d > farthest) { pivot = i; farthest = d; }
  }
  const simplified = douglasPeucker(ring.slice(0, pivot + 1), tolerance)
    .concat(douglasPeucker(ring.slice(pivot), tolerance).slice(1));
  // Keep a real vertex rather than fabricating a triangle if tolerance collapses the ring.
  return simplified.length >= 4 ? simplified : ring;
}

const reservoirWater = (water) => water === undefined || water === "reservoir" || water === "lake";

function ringArea(ring) {
  let area = 0;
  for (let i = 1; i < ring.length; i++) area += ring[i - 1][0] * ring[i][1] - ring[i][0] * ring[i - 1][1];
  return Math.abs(area) / 2;
}

/** Keeps the largest rings (outer before inner) so a many-island reservoir fits; returns how many small rings were dropped. */
export function largestRings(rings, budget = 400) {
  // ~8 points per kept ring leaves room for simplification without collapsing rings.
  const max = Math.floor(budget / 8);
  if (rings.length <= max) return { rings, dropped: 0 };
  const ranked = rings.map((ring, index) => ({ ring, index, area: ringArea(ring.coordinates) }))
    .sort((a, b) => (a.ring.role === b.ring.role ? 0 : a.ring.role === "outer" ? -1 : 1) || b.area - a.area);
  const kept = ranked.slice(0, max).sort((a, b) => a.index - b.index).map((entry) => entry.ring);
  return { rings: kept, dropped: rings.length - kept.length };
}

export function simplifyRings(rings, budget = 400) {
  if (rings.length * 4 > budget) throw new Error("Too many rings for point budget; no rings discarded");
  let result = rings;
  let tolerance = 0.000001;
  for (let attempt = 0; result.reduce((n, r) => n + r.coordinates.length, 0) > budget; attempt++) {
    if (attempt >= 40) throw new Error("Geometry cannot fit point budget without collapsing rings");
    result = rings.map((r) => ({ role: r.role, coordinates: simplifyRing(r.coordinates, tolerance) }));
    tolerance *= 1.6;
  }
  return result.map((r) => ({ role: r.role, coordinates: r.coordinates.map((p) => p.map((v) => Math.round(v * 1e6) / 1e6)) }));
}

function matchesName(tags, dam) {
  const names = [tags?.name, tags?.["name:th"], tags?.["name:en"], tags?.alt_name].filter(Boolean).flatMap((n) => n.split(";"));
  return names.some((n) => [dam.nameTh, dam.nameEn].some((target) => normalize(n) === normalize(target)));
}

export function overpassQuery(dams = DAM_REGISTRY) {
  // One request, but only 3 km around each RID dam: the country-wide variant times out (HTTP 504) on a busy server.
  const around = dams.map((dam) => `nwr["waterway"="dam"](around:3000,${dam.lat},${dam.lon});`).join("");
  return `[out:json][timeout:120];(${around});out geom;`;
}

export function reservoirQuery(walls) {
  if (!walls.length) return null;
  // around a set covers the union of 3 km around every matched crest, including long ways.
  const ids = [...new Set(walls.map(({ element }) => `${element.type}(${element.id});`))];
  return `[out:json][timeout:120];(${ids.join("")})->.walls;nwr["natural"="water"](around.walls:3000);out geom;`;
}

export async function cachedOverpass(query, { cacheDir = join(root, ".cache/osm-dam-geo"), refresh = false,
  fetcher = fetchOverpass } = {}) {
  const path = join(cacheDir, `${createHash("sha256").update(query).digest("hex")}.json`);
  if (!refresh) {
    try {
      const json = JSON.parse(await readFile(path, "utf8"));
      if (!json.remark && Array.isArray(json.elements)) return json;
    } catch (error) {
      if (error.code !== "ENOENT" && !(error instanceof SyntaxError)) throw error;
    }
  }
  const json = await fetcher(query);
  if (json.remark || !Array.isArray(json.elements)) throw new Error("Invalid Overpass cache response");
  await mkdir(cacheDir, { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, JSON.stringify(json) + "\n");
  await rename(temporary, path);
  return json;
}

function wallCoordinates(element) {
  if (element.type === "way") return geometry(element.geometry);
  return reservoirRings(element)?.find((r) => r.role === "outer")?.coordinates ?? [];
}

function pointToPathKm(point, path) {
  let best = Infinity;
  for (let i = 1; i < path.length; i++) best = Math.min(best, pointToSegmentKm(point, path[i - 1], path[i]));
  return best;
}

export function matchDam(dam, json, registryQid = null) {
  const candidates = (json?.elements ?? []).flatMap((element) => {
    if (element.tags?.waterway !== "dam") return [];
    const coordinates = wallCoordinates(element);
    if (coordinates.length < 2) return [];
    const distance = pointToPathKm([dam.lon, dam.lat], coordinates);
    if (distance > 3) return [];
    const reason = registryQid && element.tags.wikidata === registryQid ? "wikidata" : matchesName(element.tags, dam) ? "name" : "nearest";
    const rank = { wikidata: 0, name: 1, nearest: 2 }[reason];
    const length = coordinates.slice(1).reduce((n, point, i) => n + distanceKm(coordinates[i], point), 0);
    return [{ element, coordinates, distance, reason, rank, length }];
  });
  candidates.sort((a, b) => a.rank - b.rank ||
    (a.reason === "nearest" ? a.distance - b.distance : 0) || b.length - a.length || a.element.id - b.element.id);
  const first = candidates[0];
  if (!first) return null;
  // Nearby pieces of the same crest: choose the main (longest) way in the winning tier.
  return candidates.filter((c) => c.rank === first.rank &&
    (first.reason !== "nearest" || pointToPathKm(c.coordinates[0], first.coordinates) <= 0.1))
    .sort((a, b) => b.length - a.length || a.element.id - b.element.id)[0];
}

function inside(point, ring) {
  let result = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > point[1]) !== (b[1] > point[1]) &&
      point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) result = !result;
  }
  return result;
}

function shorelineDistance(path, rings) {
  const outer = rings.filter((r) => r.role === "outer");
  if (path.some((p) => outer.some((r) => inside(p, r.coordinates)) &&
    !rings.some((r) => r.role === "inner" && inside(p, r.coordinates)))) return 0;
  let best = Infinity;
  for (const { coordinates } of outer) {
    for (const p of path) best = Math.min(best, pointToPathKm(p, coordinates));
    for (const p of coordinates) best = Math.min(best, pointToPathKm(p, path));
    // Endpoint distances alone miss a crest segment crossing a shoreline segment.
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1], b = path[i];
      const cross = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
      for (let j = 1; j < coordinates.length; j++) {
        const c = coordinates[j - 1], d = coordinates[j];
        if (cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0) return 0;
      }
    }
  }
  return best;
}

/** Same four attempts, alternating mirrors and increasing backoff as build-dams.mjs. */
export async function fetchOverpass(query, { fetcher = fetch, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), log = console.warn } = {}) {
  const errors = [];
  for (let attempt = 0; attempt < 4; attempt++) {
    const url = mirrors[attempt % mirrors.length];
    try {
      const response = await fetcher(url, { method: "POST", headers: { ...headers, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ data: query }), signal: AbortSignal.timeout(180_000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const json = await response.json();
      if (json.remark || !Array.isArray(json.elements)) throw new Error(json.remark || "Invalid Overpass elements");
      return json;
    } catch (error) { errors.push(`${url}: ${error.message}`); log(errors.at(-1)); }
    if (attempt < 3) await sleep(5000 * (attempt + 1));
  }
  throw new Error(`Overpass unavailable: ${errors.join("; ")}`);
}

async function wikidataEntities(ids) {
  if (!ids.length) return { entities: {} };
  if (ids.length > 50) {
    const entities = {};
    for (let i = 0; i < ids.length; i += 50) Object.assign(entities, (await wikidataEntities(ids.slice(i, i + 50))).entities);
    return { entities };
  }
  const url = new URL("https://www.wikidata.org/w/api.php");
  url.search = new URLSearchParams({ action: "wbgetentities", ids: ids.join("|"), props: "claims|labels", languages: "en", format: "json" });
  let lastError;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const response = await fetch(url, { headers, signal: AbortSignal.timeout(60_000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const json = await response.json();
      if (!json.entities || json.error) throw new Error(json.error?.info || "Invalid Wikidata entities");
      return json;
    } catch (error) { lastError = error; }
    if (attempt < 3) await new Promise((r) => setTimeout(r, 5000 * (attempt + 1)));
  }
  throw new Error(`Wikidata unavailable: ${lastError.message}`);
}

function instances(entity) {
  return (entity?.claims?.P31 ?? []).filter((c) => c.rank !== "deprecated")
    .map((c) => qid(c.mainsnak?.datavalue?.value?.id)).filter(Boolean);
}

export function damType(wikidata, id) {
  const instanceOf = instances(wikidata?.entities?.[id]);
  const types = new Map([["arch dam", "arch"], ["arch-gravity dam", "arch-gravity"], ["gravity dam", "gravity"],
    ["earth dam", "earth"], ["earth-fill dam", "earth"], ["earthfill dam", "earth"], ["rock-fill dam", "rockfill"], ["rockfill dam", "rockfill"]]);
  const found = [...new Set(instanceOf.map((item) => types.get(wikidata?.entities?.[item]?.labels?.en?.value?.toLowerCase())).filter(Boolean))];
  return { damType: found.length === 1 ? found[0] : null, instanceOf };
}

const metres = (value) => {
  const match = String(value ?? "").trim().match(/^(\d+(?:\.\d+)?)\s*(?:m|metres|meters)?$/i);
  return match && Number(match[1]) > 0 ? Number(match[1]) : null;
};
const cited = (entry, key) => /^https?:\/\//.test(entry?.source ?? "") ? metres(entry?.[key]) : null;

export function buildGeometry(dam, json, wikidata, dimensions = {}, registryQid = null) {
  const notes = [];
  const elements = json?.elements ?? [];
  const match = matchDam(dam, json, registryQid);
  const wall = match?.element;
  notes.push(match ? `Match: ${match.reason} (${match.distance.toFixed(3)} km); longest nearby crest way/area` : "No dam matched within 3 km (Wikidata/name/nearest)");
  const ranked = wall ? elements.flatMap((element) => {
    // Large reservoirs (e.g. Bhumibol relation 227374) are tagged natural=water only, without water=reservoir.
    if (element.tags?.natural !== "water" || !reservoirWater(element.tags.water)) return [];
    const rings = reservoirRings(element);
    if (!rings) return [];
    const distance = shorelineDistance(match.coordinates, rings);
    return distance <= 1 ? [{ element, rings, distance }] : [];
  }) : [];
  // A relation and its tagged member ways describe the same water; keep the complete relation.
  const memberIds = new Set(ranked.filter((w) => w.element.type === "relation").flatMap((w) =>
    (w.element.members ?? []).filter((m) => m.type === "way").map((m) => m.ref)));
  const water = ranked.filter((w) => !(w.element.type === "way" && memberIds.has(w.element.id)))
    .sort((a, b) => a.distance - b.distance || a.element.id - b.element.id)[0];
  if (!water) notes.push("No matching closed reservoir rings within 1 km of footprint");
  const id = qid(wall?.tags.wikidata) || registryQid;
  const type = damType(wikidata, id);
  if (!type.damType) notes.push("Wikidata P31 has no unambiguous supported dam type");
  const table = dimensions[dam.id];
  const osmHeight = metres(wall?.tags.height);
  const height = osmHeight ?? cited(table, "height");
  const crestLength = cited(table, "crestLength");
  if (height === null) notes.push(`Height unavailable: ${table?.note || "no OSM height or cited published dimension"}`);
  if (crestLength === null) notes.push(`Crest length unavailable: ${table?.note || "no cited published dimension"}`);
  const data = { id: dam.id, source: SOURCE, coordinateOrder: "lon,lat", units: "metres",
    footprint: match?.coordinates ?? null, reservoir: water?.rings ?? null,
    height, crestLength, ...type, material: wall?.tags.material || null,
    sources: { footprint: wall ? osmUrl(wall) : null, reservoir: water ? osmUrl(water.element) : null,
      height: osmHeight !== null ? osmUrl(wall) : height !== null ? table.source : null,
      crestLength: crestLength !== null ? table.source : null, damType: id ? `https://www.wikidata.org/wiki/${id}` : null }, notes };
  try {
    if (data.footprint && closed(data.footprint)) data.footprint = simplifyRings([{ role: "outer", coordinates: data.footprint }])[0].coordinates;
    if (data.reservoir) {
      const { rings, dropped } = largestRings(data.reservoir);
      if (dropped) notes.push(`Reservoir: ${dropped} smallest rings (islands/arms) omitted to fit the point budget`);
      data.reservoir = simplifyRings(rings);
    }
    // 400 shoreline points plus a large footprint can exceed the raw (not gzip) limit.
    for (let budget = 360; Buffer.byteLength(JSON.stringify(data) + "\n") > 12 * 1024; budget -= 40) {
      if (budget < 40) throw new Error("Geometry exceeds 12 KB budget");
      if (data.footprint) {
        data.footprint = closed(data.footprint) ? simplifyRings([{ role: "outer", coordinates: data.footprint }], budget)[0].coordinates
          : douglasPeucker(data.footprint, 0.000001 * 2 ** ((400 - budget) / 40));
      }
      if (data.reservoir) data.reservoir = simplifyRings(data.reservoir, budget);
    }
  } catch (error) {
    // Losing the shoreline must not also discard a valid dam footprint.
    data.reservoir = null; data.sources.reservoir = null;
    notes.push(error.message);
    if (Buffer.byteLength(JSON.stringify(data) + "\n") > 12 * 1024) { data.footprint = null; data.sources.footprint = null; }
  }
  return data;
}

export async function main(args = process.argv.slice(2)) {
  function option(name) {
    const i = args.indexOf(name);
    if (i < 0) return null;
    if (!args[i + 1] || args[i + 1].startsWith("--")) throw new Error(`${name} requires a path`);
    return args[i + 1];
  }
  const fixturePath = option("--fixture");
  const out = option("--out");
  const dry = args.includes("--dry") || Boolean(fixturePath && !out);
  const fixture = fixturePath ? JSON.parse(await readFile(resolve(fixturePath), "utf8")) : null;
  if (fixture && (!Array.isArray(fixture.overpass?.elements) || !fixture.wikidata?.entities)) throw new Error("Fixture requires overpass.elements and wikidata.entities");
  const sources = JSON.parse(await readFile(join(root, "scripts/dams/registry-sources.json"), "utf8"));
  const dimensions = JSON.parse(await readFile(join(root, "scripts/dams/dam-dims.json"), "utf8"));
  if (DAM_REGISTRY.length !== 35) throw new Error(`Expected 35 RID dams, found ${DAM_REGISTRY.length}`);
  const output = out ? resolve(out) : join(root, "public/data/dam-geo");
  if (!dry) await mkdir(output, { recursive: true });
  const registryId = (dam) => qid(sources.dams.find((s) => s.ridId === dam.id)?.source.replace(/^wikidata:/, ""));
  let overpass = fixture?.overpass, wikidata = fixture?.wikidata;
  const failures = [];
  if (!fixture) {
    const cacheOptions = { refresh: args.includes("--refresh") };
    try { overpass = await cachedOverpass(overpassQuery(), cacheOptions); }
    catch (error) { failures.push(error.message); }
    const walls = DAM_REGISTRY.map((dam) => matchDam(dam, overpass, registryId(dam))).filter(Boolean);
    const query = reservoirQuery(walls);
    if (query) {
      try {
        const water = await cachedOverpass(query, cacheOptions);
        overpass = { elements: [...overpass.elements, ...water.elements] };
      } catch (error) { failures.push(error.message); }
    }
    const ids = [...new Set([...DAM_REGISTRY.map(registryId), ...walls.map((w) => qid(w.element.tags.wikidata))].filter(Boolean))];
    try {
      wikidata = await wikidataEntities(ids);
      const types = [...new Set(Object.values(wikidata.entities).flatMap(instances))];
      const labels = await wikidataEntities(types);
      wikidata.entities = { ...wikidata.entities, ...labels.entities };
    } catch (error) { failures.push(error.message); }
  }
  let complete = 0;
  const rows = [];
  for (const dam of DAM_REGISTRY) {
    const registryQid = registryId(dam);
    const data = buildGeometry(dam, overpass, wikidata, dimensions, registryQid);
    data.notes.push(...failures);
    const content = JSON.stringify(data) + "\n";
    if (Buffer.byteLength(content) > 12 * 1024) throw new Error(`${dam.id}: metadata exceeds 12 KB`);
    if (!dry) await writeFile(join(output, `${dam.id}.json`), content);
    if (data.footprint && data.reservoir) complete++;
    rows.push({ id: dam.id, name: dam.nameTh, footprint: data.footprint?.length ?? "null",
      reservoir: data.reservoir?.reduce((n, r) => n + r.coordinates.length, 0) ?? "null",
      height: data.height ?? "null", "match reason": data.notes[0] });
    if (failures.length) console.log(`${dam.id}: ${failures.join("; ")}`);
  }
  console.table(rows);
  console.log(`${dry ? "Dry run" : output}: 35 dams; ${complete} with both geometries; ${35 - complete} missing geometry (reasons above)`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
