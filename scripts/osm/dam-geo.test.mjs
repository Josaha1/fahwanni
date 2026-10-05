import { test } from "vitest";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { DAM_REGISTRY } from "../../src/lib/dams/registry.ts";
import { SOURCE, buildGeometry, damType, cachedOverpass, fetchOverpass, largestRings, matchDam, overpassQuery, reservoirQuery, reservoirRings, simplifyRings } from "./build-dam-geo.mjs";

const fixture = JSON.parse(await readFile(new URL("./fixtures/dam-geo.json", import.meta.url), "utf8"));
const bhumibol = DAM_REGISTRY.find((dam) => dam.id === "200101");
const sirikit = DAM_REGISTRY.find((dam) => dam.id === "200102");
const clone = () => structuredClone(fixture);
const build = (f = fixture, dimensions = {}) => buildGeometry(bhumibol, f.overpass, f.wikidata, dimensions, "Q855098");

test("uses supplied OSM heights, area footprint, P31 type and source URLs", () => {
  const data = build();
  assert.equal(data.height, 154);
  assert.equal(data.crestLength, null);
  assert.equal(data.damType, "arch");
  assert.equal(data.material, "concrete");
  assert.equal(data.source, SOURCE);
  assert.equal(data.coordinateOrder, "lon,lat");
  assert.deepEqual(data.footprint[0], [98.972, 17.242]);
  assert.equal(data.sources.height, "https://www.openstreetmap.org/way/36835245");
  assert.equal(data.sources.damType, "https://www.wikidata.org/wiki/Q855098");
  const second = buildGeometry(sirikit, fixture.overpass, fixture.wikidata, {}, "Q339848");
  assert.equal(second.height, 113.6);
  assert.equal(second.damType, "earth");
  assert.equal(second.sources.footprint, "https://www.openstreetmap.org/way/36814722");
});

test("joins reversed and unordered outer and inner members, without inventing closure", () => {
  const relation = fixture.overpass.elements[2];
  const rings = reservoirRings(relation);
  assert.deepEqual(rings.map((r) => r.role), ["outer", "inner"]);
  assert.ok(rings.every((r) => r.coordinates.length === 5));
  assert.ok(rings.every((r) => JSON.stringify(r.coordinates[0]) === JSON.stringify(r.coordinates.at(-1))));
  const broken = structuredClone(relation);
  broken.members.pop();
  assert.equal(reservoirRings(broken), null);
  broken.members[0].geometry[0] = null;
  assert.equal(reservoirRings(broken), null);
});

test("accepts crest lines and closed ways without area=yes", () => {
  for (const change of ["open", "area=no", "no area tag"]) {
    const f = clone();
    if (change === "open") f.overpass.elements[0].geometry.pop();
    else if (change === "area=no") f.overpass.elements[0].tags.area = "no";
    else delete f.overpass.elements[0].tags.area;
    const data = build(f);
    assert.ok(data.footprint);
    assert.equal(data.height, 154);
  }
});

test("matches Thai/English names when the registry has no Wikidata ID", () => {
  const f = clone();
  delete f.overpass.elements[0].tags.wikidata;
  const data = buildGeometry(bhumibol, f.overpass, f.wikidata);
  assert.ok(data.footprint);
  assert.equal(data.damType, null);
  delete f.overpass.elements[0].tags.name;
  assert.ok(buildGeometry(bhumibol, f.overpass, f.wikidata).footprint);
});

test("reports missing dams and deterministically chooses tied pieces", () => {
  const missing = buildGeometry(bhumibol, { elements: [] }, { entities: {} });
  assert.equal(missing.footprint, null);
  assert.equal(missing.reservoir, null);
  assert.equal(missing.height, null);
  assert.equal(missing.crestLength, null);
  assert.match(missing.notes.join(" "), /No dam matched/);
  const f = clone();
  f.overpass.elements.push({ ...f.overpass.elements[0], id: 123 });
  assert.equal(build(f).sources.footprint, "https://www.openstreetmap.org/way/123");
});

test("only uses dimension fallback with a URL, prefers OSM height, validates units", () => {
  const table = { "200101": { height: 150, crestLength: 400, source: "https://example.test/published", note: "test only" } };
  assert.equal(build(fixture, table).height, 154);
  assert.equal(build(fixture, table).crestLength, 400);
  const f = clone();
  f.overpass.elements[0].tags.height = "154 ft";
  assert.equal(build(f, table).height, 150);
  assert.equal(build(f, table).sources.height, table["200101"].source);
  table["200101"].source = null;
  assert.equal(build(f, table).height, null);
  assert.equal(build(f, table).crestLength, null);
  f.overpass.elements[0].tags.height = "154 m";
  assert.equal(build(f).height, 154);
});

test("P31 ignores deprecated/unknown claims and reports conflicting supported types", () => {
  const f = clone();
  f.wikidata.entities.Q855098.claims.P31[0].rank = "deprecated";
  assert.deepEqual(damType(f.wikidata, "Q855098"), { damType: null, instanceOf: [] });
  assert.equal(damType({}, "Q855098").damType, null);
  f.wikidata.entities.Q855098.claims.P31[0].rank = "normal";
  f.wikidata.entities.Q855098.claims.P31.push(f.wikidata.entities.Q339848.claims.P31[0]);
  assert.equal(damType(f.wikidata, "Q855098").damType, null);
});

test("does not treat a relation member way as another reservoir", () => {
  const f = clone();
  const rings = reservoirRings(f.overpass.elements[2]);
  f.overpass.elements.push({ type: "way", id: 900000011, tags: { natural: "water", water: "reservoir", name: "อ่างเก็บน้ำภูมิพล" },
    geometry: rings[0].coordinates.map(([lon, lat]) => ({ lon, lat })) });
  assert.ok(build(f).reservoir);
  assert.equal(build(f).sources.reservoir, "https://www.openstreetmap.org/relation/900000001");
  f.overpass.elements.push({ ...f.overpass.elements[3], id: 987, tags: { natural: "water", water: "reservoir", name: "อ่างเก็บน้ำภูมิพล" } });
  assert.equal(build(f).sources.reservoir, "https://www.openstreetmap.org/relation/900000001");
});

test("unnamed reservoir needs a footprint and nearby shoreline; unrelated water is rejected", () => {
  const f = clone();
  delete f.overpass.elements[2].tags.name;
  assert.ok(build(f).reservoir);
  f.overpass.elements[0].geometry = [];
  assert.equal(build(f).reservoir, null);
  const g = clone();
  delete g.overpass.elements[2].tags.name;
  g.overpass.elements[2].tags.water = "river";
  assert.equal(build(g).reservoir, null);
  // Bhumibol's reservoir (relation 227374) carries natural=water with no water=* tag.
  const h = clone();
  delete h.overpass.elements[2].tags.water;
  assert.ok(build(h).reservoir);
});

test("keeps the largest rings when a reservoir has too many islands, and keeps the footprint", () => {
  const islands = Array.from({ length: 150 }, (_, i) => circle(8, 0.0005 + i * 0.00001, "inner"));
  const { rings, dropped } = largestRings([circle(500, 0.1), ...islands]);
  assert.equal(rings.length, 50);
  assert.equal(dropped, 101);
  assert.equal(rings[0].role, "outer");
  assert.ok(simplifyRings(rings).length === 50);
});

function circle(n, radius, role = "outer") {
  const coordinates = Array.from({ length: n }, (_, i) => [98.972 + radius * Math.cos(i * 2 * Math.PI / n), 17.242 + radius * Math.sin(i * 2 * Math.PI / n)]);
  coordinates.push(coordinates[0]);
  return { role, coordinates };
}

test("simplifies shoreline to at most 400 total points while keeping closed islands", () => {
  const rings = simplifyRings([circle(2000, 0.1), circle(1000, 0.01, "inner")]);
  assert.ok(rings.reduce((n, r) => n + r.coordinates.length, 0) <= 400);
  assert.deepEqual(rings.map((r) => r.role), ["outer", "inner"]);
  assert.ok(rings.every((r) => r.coordinates.length >= 4));
  assert.ok(rings.every((r) => JSON.stringify(r.coordinates[0]) === JSON.stringify(r.coordinates.at(-1))));
  assert.throws(() => simplifyRings(Array.from({ length: 101 }, () => circle(3, 0.1))), /Too many rings/);
});

test("large wall and shoreline fit the 12 KB raw limit", () => {
  const f = clone();
  f.overpass.elements[0].geometry = circle(2000, 0.001).coordinates.map(([lon, lat]) => ({ lon, lat }));
  f.overpass.elements[2] = { type: "way", id: 900000003, tags: { natural: "water", water: "reservoir", name: "อ่างเก็บน้ำภูมิพล" },
    geometry: circle(3000, 0.1).coordinates.map(([lon, lat]) => ({ lon, lat })) };
  const data = build(f);
  assert.ok(data.footprint && data.reservoir);
  assert.ok(data.reservoir[0].coordinates.length <= 400);
  assert.ok(Buffer.byteLength(JSON.stringify(data) + "\n") <= 12 * 1024);
});

test("queries dams once within 3 km of every RID dam and reservoirs around the matched footprints only", () => {
  const query = overpassQuery([bhumibol, sirikit]);
  assert.equal((query.match(/nwr\["waterway"="dam"\]\(around:3000,/g) ?? []).length, 2);
  assert.match(query, new RegExp(`around:3000,${bhumibol.lat},${bhumibol.lon}`));
  assert.ok(query.endsWith(");out geom;") && !query.includes("~"));
  const water = reservoirQuery([matchDam(bhumibol, fixture.overpass, "Q855098"), matchDam(sirikit, fixture.overpass)]);
  assert.match(water, /way\(36835245\);way\(36814722\);/);
  assert.match(water, /nwr\["natural"="water"\]\(around.walls:3000\);out geom;/);
  assert.equal(reservoirQuery([]), null);
});

const maeKuang = DAM_REGISTRY.find((d) => d.id === "100104");
const crest = (id, tags = {}, offset = 0, length = 0.001) => ({ type: "way", id, tags: { waterway: "dam", ...tags },
  geometry: [{ lon: maeKuang.lon + offset, lat: maeKuang.lat }, { lon: maeKuang.lon + offset + length, lat: maeKuang.lat }] });

test("fixture Thai prefix normalizes to the RID name, Wikidata wins over name, >3 km never matches", () => {
  const named = crest(1, { name: "เขื่อนแม่กวงอุดมธารา" });
  const exact = crest(2, { name: "different spelling", wikidata: "Q31349503" }, 0.002);
  assert.equal(matchDam(maeKuang, { elements: [named] }).reason, "name");
  assert.equal(matchDam(maeKuang, { elements: [named, exact] }, "Q31349503").element.id, 2);
  const far = crest(3, { ...named.tags, wikidata: "Q31349503" }, 0.05);
  assert.equal(matchDam(maeKuang, { elements: [far] }, "Q31349503"), null);
  assert.equal(buildGeometry(maeKuang, { elements: [far] }, {}).footprint, null);
});

test("normalizes English case/spaces/Dam and selects the longest name-matched piece", () => {
  const short = crest(1, { "name:en": "MAE KUANG UDOM THARA DAM" });
  const long = crest(2, { name: "เขื่อนแม่กวงอุดมธารา" }, 0.0001, 0.01);
  assert.equal(matchDam(maeKuang, { elements: [short] }).reason, "name");
  const data = buildGeometry(maeKuang, { elements: [short, long] }, {});
  assert.equal(data.sources.footprint, "https://www.openstreetmap.org/way/2");
  assert.match(data.notes[0], /Match: name/);
});

test("nearest fallback selects the longest nearby crest, with a reason in notes", () => {
  const short = crest(1), long = crest(2, {}, 0.0001, 0.01), unrelated = crest(3, {}, 0.02, 0.02);
  const data = buildGeometry(maeKuang, { elements: [unrelated, short, long] }, {});
  assert.equal(data.sources.footprint, "https://www.openstreetmap.org/way/2");
  assert.match(data.notes[0], /Match: nearest/);
});

test("closest reservoir wins regardless of name, beyond 1 km is rejected; crossing segments touch", () => {
  const wall = crest(1, {}, 0, 0.03);
  const water = (id, offset, name) => ({ type: "way", id, tags: { natural: "water", water: "reservoir", name },
    geometry: [[0.01, offset], [0.02, offset], [0.02, offset + 0.001], [0.01, offset + 0.001], [0.01, offset]]
      .map(([lon, lat]) => ({ lon: maeKuang.lon + lon, lat: maeKuang.lat + lat })) });
  const named = water(2, 0.007, "แม่กวงอุดมธารา"), close = water(3, -0.0005, "other");
  const buildWater = (waters) => buildGeometry(maeKuang, { elements: [wall, ...waters] }, {});
  assert.equal(buildWater([named, close]).sources.reservoir, "https://www.openstreetmap.org/way/3");
  assert.equal(buildWater([water(4, 0.02, "แม่กวงอุดมธารา")]).reservoir, null);
});

test("raw response cache resumes, refresh replaces it, query changes invalidate it", async () => {
  const cacheDir = await mkdtemp(join(tmpdir(), "dam-cache-"));
  let calls = 0;
  const fetcher = async () => { calls++; return { elements: [{ id: calls }] }; };
  try {
    const options = { cacheDir, fetcher };
    assert.equal((await cachedOverpass("dam-query", options)).elements[0].id, 1);
    assert.equal((await cachedOverpass("dam-query", options)).elements[0].id, 1);
    assert.equal(calls, 1);
    await assert.rejects(cachedOverpass("water-query", { ...options, fetcher: async () => { throw new Error("interrupted"); } }), /interrupted/);
    assert.equal((await cachedOverpass("dam-query", options)).elements[0].id, 1);
    assert.equal((await cachedOverpass("dam-query", { ...options, refresh: true })).elements[0].id, 2);
    assert.equal((await cachedOverpass("water-query", options)).elements[0].id, 3);
    assert.equal((await readdir(cacheDir)).length, 2);
    assert.ok((await readdir(cacheDir)).every((p) => p.endsWith(".json")));
  } finally { await rm(cacheDir, { recursive: true, force: true }); }
});

test("retry alternates mirrors with User-Agent, timeout and increasing backoff", async () => {
  const urls = [], delays = [];
  const result = await fetchOverpass("query", {
    fetcher: async (url, options) => {
      urls.push(url);
      assert.match(options.headers["User-Agent"], /fahwanni/);
      assert.equal(options.body.get("data"), "query");
      assert.ok(options.signal instanceof AbortSignal);
      if (urls.length === 1) throw new Error("offline");
      if (urls.length === 2) return { ok: false, status: 429 };
      if (urls.length === 3) return { ok: true, json: async () => ({ remark: "runtime timeout", elements: [] }) };
      return { ok: true, json: async () => fixture.overpass };
    }, sleep: async (ms) => { delays.push(ms); }, log: () => {},
  });
  assert.equal(result, fixture.overpass);
  assert.equal(urls[0], urls[2]);
  assert.equal(urls[1], urls[3]);
  assert.notEqual(urls[0], urls[1]);
  assert.deepEqual(delays, [5000, 10000, 15000]);
  await assert.rejects(fetchOverpass("query", { fetcher: async () => { throw new Error("offline"); }, sleep: async () => {}, log: () => {} }), /Overpass unavailable.*offline/);
});

test("CLI fixture/dry uses no network, writes no files; fixture output covers all 35 with reasons", async () => {
  const output = await mkdtemp(join(tmpdir(), "dam-geo-"));
  const script = new URL("./build-dam-geo.mjs", import.meta.url);
  const fixturePath = new URL("./fixtures/dam-geo.json", import.meta.url);
  const run = (args) => spawnSync(process.execPath, ["--import", "data:text/javascript,globalThis.fetch=()=>{throw new Error('network forbidden')}", script.pathname,
    "--fixture", fixturePath.pathname, ...args], { encoding: "utf8" });
  try {
    const dry = run(["--dry", "--out", output]);
    assert.equal(dry.status, 0, dry.stderr);
    assert.deepEqual(await readdir(output), []);
    assert.equal(dry.stdout.split("\n").filter((line) => DAM_REGISTRY.some((d) => line.includes(d.id))).length, 35);
    assert.match(dry.stdout, /match reason/);
    assert.match(dry.stdout, /Dry run: 35 dams; 2 with both geometries; 33 missing geometry/);
    const defaultDry = run([]);
    assert.equal(defaultDry.status, 0, defaultDry.stderr);
    assert.match(defaultDry.stdout, /Dry run: 35 dams/);
    const written = run(["--out", output]);
    assert.equal(written.status, 0, written.stderr);
    assert.equal((await readdir(output)).length, 35);
    for (const dam of DAM_REGISTRY) {
      const content = await readFile(join(output, `${dam.id}.json`), "utf8");
      assert.ok(Buffer.byteLength(content) <= 12 * 1024);
      const data = JSON.parse(content);
      assert.equal(data.id, dam.id);
      assert.equal(data.source, SOURCE);
      if (!["200101", "200102"].includes(dam.id)) {
        assert.equal(data.footprint, null);
        assert.equal(data.height, null);
        assert.match(data.notes.join(" "), /No dam matched/);
      }
    }
  } finally { await rm(output, { recursive: true, force: true }); }
});

test("dimension table covers 35 registry IDs and has no uncited numeric values", async () => {
  const table = JSON.parse(await readFile(new URL("../dams/dam-dims.json", import.meta.url), "utf8"));
  assert.deepEqual(Object.keys(table).sort(), DAM_REGISTRY.map((d) => d.id).sort());
  for (const row of Object.values(table)) {
    for (const key of ["height", "crestLength"]) {
      if (row[key] !== null) assert.match(row.source, /^https?:\/\//);
      else assert.ok(row.note);
    }
  }
});

test("CLI continues all 35 dams when Overpass and Wikidata requests fail", () => {
  const mock = "globalThis.fetch=async()=>{throw new Error('offline fixture failure')};globalThis.setTimeout=(callback)=>{callback();return 0}";
  const result = spawnSync(process.execPath, ["--import", `data:text/javascript,${encodeURIComponent(mock)}`,
    new URL("./build-dam-geo.mjs", import.meta.url).pathname, "--dry", "--refresh"], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /200604.*บางลาง.*null.*null/);
  assert.match(result.stdout, /Overpass unavailable:.*offline fixture failure/);
  assert.match(result.stdout, /Wikidata unavailable: offline fixture failure/);
  assert.match(result.stdout, /Dry run: 35 dams; 0 with both geometries; 35 missing geometry/);
});
