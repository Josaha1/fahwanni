// Snapshot of OpenStreetMap dams in Thailand (waterway=dam, ODbL) → public/data/osm-dams.json.
//   node scripts/osm/build-dams.mjs
// Build-time only: Overpass is never called at runtime. Places already shown with water data (RID's 35 dams,
// DWR reservoirs) are dropped. The output is a derived ODbL database: keep the attribution in the app.
import { readFile, writeFile } from "node:fs/promises";
import { request } from "node:https";
import { rootCertificates } from "node:tls";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { damsFromOverpass, registryPoints, withoutKnown } from "./dams.mjs";

const root = fileURLToPath(new URL("../..", import.meta.url));
const output = join(root, "public/data/osm-dams.json");
const headers = { "User-Agent": "fahwanni/1.0 (https://fahwanni.vercel.app; build script)" };
const query = '[out:json][timeout:120];area["ISO3166-1"="TH"][admin_level=2]->.th;(nwr["waterway"="dam"](area.th););out center tags;';
const servers = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];

async function overpass() {
  for (let attempt = 0; attempt < 4; attempt++) {
    const url = servers[attempt % servers.length];
    try {
      const response = await fetch(url, { method: "POST", headers: { ...headers, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ data: query }), signal: AbortSignal.timeout(180_000) });
      if (response.ok) return response.json();
      console.log(`${url}: HTTP ${response.status}`);
    } catch (error) { console.log(`${url}: ${error.message}`); }
    await new Promise((resolve) => setTimeout(resolve, 5000 * (attempt + 1)));
  }
  throw new Error("Overpass unavailable");
}

// DWR omits its intermediate certificate; reuse the one bundled for the app (src/lib/net/sectigo-dv-r36.ts).
const sectigo = (await readFile(join(root, "src/lib/net/sectigo-dv-r36.ts"), "utf8")).match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/)[0];

function getJson(url) {
  return new Promise((resolve, reject) => {
    request(url, { headers, ca: [...rootCertificates, sectigo], timeout: 60_000 }, (response) => {
      if (response.statusCode !== 200) { response.resume(); reject(new Error(`${url}: HTTP ${response.statusCode}`)); return; }
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))); } catch (error) { reject(error); } });
    }).on("error", reject).end();
  });
}

async function dwrPoints() {
  const names = ["MediumSizeWaterResourcesInfo", "SmallSizeWaterResourcesInfo"];
  const lists = await Promise.all(names.map(async (name) => (await getJson(`https://api.dwr.go.th/twsapi/public/v1.0/${name}`)).waterResources ?? []));
  return lists.flat().map(({ waterResourcesMetadata: meta }) => ({ nameTh: meta?.waterResourcesName ?? "", lat: Number(meta?.latitude), lon: Number(meta?.longitude) }))
    .filter((place) => Number.isFinite(place.lat) && Number.isFinite(place.lon));
}

const rid = registryPoints(await readFile(join(root, "src/lib/dams/registry.ts"), "utf8"));
if (rid.length !== 35) throw new Error(`Expected 35 RID dams in registry.ts, parsed ${rid.length}`);
const all = damsFromOverpass(await overpass());
const kept = withoutKnown(all, [...rid, ...await dwrPoints()]);
const data = { generatedAt: new Date().toISOString(), source: "© OpenStreetMap contributors, ODbL", dams: kept };
await writeFile(output, `${JSON.stringify(data)}\n`);
console.log(`OSM dams: ${all.length} found, ${kept.length} kept (${kept.filter((dam) => dam.nameTh).length} named) → ${output}`);
