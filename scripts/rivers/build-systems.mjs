import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DAM_REGISTRY } from "../../src/lib/dams/registry.ts";
import { provinces } from "../../src/lib/provinces.ts";

export const source = "HydroRIVERS v10 (CC BY 4.0) via dam-downstream.json; topology hand-authored";

// Membership is deliberately explicit: sharing a province does not make two rivers connected.
// Each row is [system, branch id, Thai river name, English river name].
export const membership = {
  "100104": ["chao-phraya", "ping", "ปิง", "Ping"],
  "100105": ["chao-phraya", "wang", "วัง", "Wang"],
  "100106": ["chao-phraya", "wang", "วัง", "Wang"],
  "100107": ["chao-phraya", "nan", "น่าน", "Nan"],
  "100108": ["chao-phraya", "yom", "ยม", "Yom"],
  "200101": ["chao-phraya", "ping", "ปิง", "Ping"],
  "200102": ["chao-phraya", "nan", "น่าน", "Nan"],
  "200103": ["chao-phraya", "ping", "ปิง", "Ping"],
  "100301": ["chao-phraya", "pa-sak", "ป่าสัก", "Pa Sak"],
  "100302": ["chao-phraya", "sakae-krang", "สะแกกรัง", "Sakae Krang"],
  "100303": ["chao-phraya", "tha-chin", "ท่าจีน", "Tha Chin"],
  "100206": ["chi-mun", "lam-pao", "ลำปาว", "Lam Pao"],
  "200204": ["chi-mun", "nam-phong", "น้ำพอง", "Nam Phong"],
  "200205": ["chi-mun", "nam-phong", "น้ำพอง", "Nam Phong"],
  "100207": ["chi-mun", "lam-takhong", "ลำตะคอง", "Lam Takhong"],
  "100208": ["chi-mun", "lam-phra-phloeng", "ลำพระเพลิง", "Lam Phra Phloeng"],
  "100209": ["chi-mun", "mun", "มูล", "Mun"],
  "100210": ["chi-mun", "lam-chae", "ลำแชะ", "Lam Chae"],
  "100211": ["chi-mun", "lam-nang-rong", "ลำนางรอง", "Lam Nang Rong"],
  "200212": ["chi-mun", "dom-noi", "โดมน้อย", "Dom Noi"],
  "100201": ["mekong", "huai-luang", "ห้วยหลวง", "Huai Luang"],
  "100202": ["mekong", "nam-oon", "น้ำอูน", "Nam Oon"],
  "200203": ["mekong", "nam-kam", "น้ำก่ำ", "Nam Kam"],
  "200603": ["tapi", "phum-duang", "พุมดวง", "Phum Duang"],
  "200604": ["pattani", "pattani", "ปัตตานี", "Pattani"],
  "200401": ["other", "mae-klong", "แม่กลอง", "Mae Klong"],
  "200402": ["other", "mae-klong", "แม่กลอง", "Mae Klong"],
  "100501": ["other", "nakhon-nayok", "นครนายก", "Nakhon Nayok"],
  "100502": ["other", "khlong-si-yat", "คลองสียัด", "Khlong Si Yat"],
  "100514": ["other", "prachin-buri", "ปราจีนบุรี", "Prachin Buri"],
  "100503": ["other", "bang-phra", "บางพระ", "Bang Phra"],
  "100504": ["other", "khlong-yai", "คลองใหญ่", "Khlong Yai"],
  "100505": ["other", "prasae", "ประแสร์", "Prasae"],
  "100602": ["other", "pran-buri", "ปราณบุรี", "Pran Buri"],
  "200601": ["other", "phetchaburi", "เพชรบุรี", "Phetchaburi"],
};

const systemNames = [
  ["chao-phraya", "เจ้าพระยา", "Chao Phraya"],
  ["chi-mun", "ชี–มูล", "Chi–Mun"],
  ["mekong", "โขง (สาขาที่มีเขื่อน RID)", "Mekong (RID tributaries)"],
  ["tapi", "ตาปี", "Tapi"],
  ["pattani", "ปัตตานี", "Pattani"],
  ["other", "แม่น้ำอื่น", "Other rivers"],
];

/** Collect ancestors once per edge, including cascaded dams, without double counting a merge. */
export function upstreamDamIds(nodes, edges) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  if (byId.size !== nodes.length) throw new Error("Duplicate node id");
  const incoming = new Map(nodes.map((node) => [node.id, []]));
  for (const edge of edges) {
    if (!byId.has(edge.from) || !byId.has(edge.to)) throw new Error(`Dangling edge ${edge.from} -> ${edge.to}`);
    incoming.get(edge.to).push(edge.from);
  }
  const memo = new Map();
  const visiting = new Set();
  function ancestors(id) {
    if (memo.has(id)) return memo.get(id);
    if (visiting.has(id)) throw new Error(`Cycle at ${id}`);
    visiting.add(id);
    const node = byId.get(id);
    const ids = new Set(node.kind === "dam" ? [node.damId] : []);
    for (const parent of incoming.get(id)) for (const damId of ancestors(parent)) ids.add(damId);
    visiting.delete(id);
    memo.set(id, [...ids].sort());
    return memo.get(id);
  }
  for (const node of nodes) ancestors(node.id);
  return edges.map((edge) => ({ ...edge, damIds: ancestors(edge.from) }));
}

/** One downstream exit per reach. Fixed lanes fit 390 px; length can scroll vertically. */
export function layoutSystem(nodes, edges) {
  const byId = new Map(nodes.map((node) => [node.id, { ...node }]));
  const next = new Map();
  for (const edge of edges) {
    if (!byId.has(edge.from) || !byId.has(edge.to)) throw new Error("Dangling layout edge");
    if (next.has(edge.from)) throw new Error(`Multiple downstream exits at ${edge.from}`);
    next.set(edge.from, edge.to);
  }
  const memo = new Map();
  const visiting = new Set();
  function position(id) {
    if (memo.has(id)) return memo.get(id);
    if (visiting.has(id)) throw new Error(`Cycle at ${id}`);
    visiting.add(id);
    const node = byId.get(id);
    const to = next.get(id);
    if (!to && node.kind !== "sea") throw new Error(`Reach does not end at sea: ${id}`);
    const downstream = to ? position(to) : { y: 0, outlet: id };
    // A change of lane is exactly 45 degrees; vertical segments leave space for labels.
    const step = to ? Math.abs(node.x - byId.get(to).x) || 80 : 0;
    const result = { y: downstream.y - step, outlet: downstream.outlet };
    visiting.delete(id);
    memo.set(id, result);
    return result;
  }
  for (const node of nodes) position(node.id);
  let offset = 40;
  for (const outlet of nodes.filter((node) => node.kind === "sea")) {
    const component = nodes.filter((node) => memo.get(node.id).outlet === outlet.id);
    const min = Math.min(...component.map((node) => memo.get(node.id).y));
    for (const node of component) byId.get(node.id).y = memo.get(node.id).y - min + offset;
    // Unrelated rivers in `other` have separate outlets and separate vertical panels.
    offset = byId.get(outlet.id).y + 160;
  }
  return nodes.map((node) => byId.get(node.id));
}

export function buildSystems(downstream, registry = DAM_REGISTRY, generatedAt = new Date().toISOString()) {
  const registered = new Map(registry.map((dam) => [dam.id, dam]));
  const systems = systemNames.map(([id, th, en]) => ({ id, th, en, branches: [], nodes: [], edges: [] }));
  const bySystem = new Map(systems.map((system) => [system.id, system]));
  const nodeIds = new Set();
  let current;
  const dam = (damId) => ({ id: `dam-${damId}`, kind: "dam", damId, provinceId: registered.get(damId)?.provinceId });
  const confluence = (id) => ({ id, kind: "confluence" });
  const sea = (id) => ({ id, kind: "sea" });
  function provinceNodes(damId, reach, ids) {
    const route = downstream.dams[damId];
    if (!route) throw new Error(`Missing downstream route ${damId}`);
    const selected = route.provinces.filter((province) => ids.includes(province.id)).sort((a, b) => a.km - b.km);
    if (selected.length !== ids.length) throw new Error(`Missing province in ${damId} / ${reach}: ${ids.join(", ")}`);
    return selected.map(({ id }) => ({ id: `${reach}-${id}`, kind: "province", provinceId: id }));
  }
  function reach(x, nodes, to) {
    for (const node of nodes) {
      const id = `${current.id}:${node.id}`;
      if (nodeIds.has(id)) throw new Error(`Duplicate authored node ${id}`);
      nodeIds.add(id);
      current.nodes.push({ ...node, id, x });
    }
    const ids = nodes.map((node) => `${current.id}:${node.id}`);
    if (to) ids.push(`${current.id}:${to}`);
    for (let i = 1; i < ids.length; i++) current.edges.push({ from: ids[i - 1], to: ids[i] });
  }
  const p = provinceNodes;
  const c = confluence;
  const d = dam;
  const s = sea;

  // Province sequences are selected from the source in km order. Junctions and continuations
  // beyond the source's 700 km cap are authored here, not inferred from province proximity.
  current = bySystem.get("chao-phraya");
  reach(40, [d("200103")], "upper-ping");
  reach(120, [d("100104")], "upper-ping");
  reach(80, [c("upper-ping"), ...p("100104", "upper-ping", ["chiang-mai", "lamphun"]), d("200101")], "ping-wang");
  reach(120, [d("100106"), d("100105"), ...p("100105", "wang", ["lampang"])], "ping-wang");
  reach(80, [c("ping-wang"), ...p("200101", "ping", ["tak", "kamphaeng-phet"])], "ping-nan");
  reach(240, [d("200102"), ...p("200102", "upper-nan", ["uttaradit"])], "nan-khwae-noi");
  reach(280, [d("100107")], "nan-khwae-noi");
  reach(240, [c("nan-khwae-noi"), ...p("200102", "nan", ["phitsanulok"])], "yom-nan");
  reach(200, [d("100108"), ...p("100108", "yom", ["sukhothai"])], "yom-nan");
  reach(240, [c("yom-nan"), ...p("200102", "lower-nan", ["phichit"])], "ping-nan");
  reach(160, [c("ping-nan"), ...p("200101", "chao-phraya", ["nakhon-sawan"])], "sakae-krang-chao-phraya");
  reach(40, [d("100302")], "sakae-krang-chao-phraya");
  reach(160, [c("sakae-krang-chao-phraya"), ...p("200101", "chao-phraya", ["uthai-thani", "chai-nat", "sing-buri", "ang-thong"])], "pa-sak-chao-phraya");
  reach(280, [d("100301"), ...p("100301", "pa-sak", ["saraburi"])], "pa-sak-chao-phraya");
  reach(160, [c("pa-sak-chao-phraya"), ...p("200101", "chao-phraya", ["phra-nakhon-si-ayutthaya", "pathum-thani", "nonthaburi", "bangkok", "samut-prakan"]), s("gulf-chao-phraya")]);
  // Krasiao drains to Tha Chin, not through Bangkok. No unquantified Chao Phraya split is added.
  reach(320, [d("100303"), ...p("100303", "tha-chin", ["suphan-buri", "nakhon-pathom", "samut-sakhon"]), s("gulf-tha-chin")]);

  current = bySystem.get("chi-mun");
  reach(40, [d("200204"), d("200205"), ...p("200205", "chi", ["khon-kaen", "maha-sarakham"])], "lam-pao-chi");
  reach(80, [d("100206"), ...p("100206", "lam-pao", ["kalasin"])], "lam-pao-chi");
  reach(40, [c("lam-pao-chi"), ...p("100206", "chi", ["yasothon"])], "chi-mun");
  // Shared coordinates in dam-paths put the Mun joins in this order, upstream to downstream:
  // Lam Chae (~6 km below Mun Bon), Lam Phra Phloeng (~31), Lam Takhong (~64), Lam Nang Rong (~143).
  reach(200, [d("100209")], "lam-chae-mun");
  reach(240, [d("100210")], "lam-chae-mun");
  reach(200, [c("lam-chae-mun")], "lam-phra-phloeng-mun");
  reach(160, [d("100208")], "lam-phra-phloeng-mun");
  reach(200, [c("lam-phra-phloeng-mun")], "lam-takhong-mun");
  reach(120, [d("100207"), ...p("100207", "lam-takhong", ["nakhon-ratchasima"])], "lam-takhong-mun");
  reach(200, [c("lam-takhong-mun")], "lam-nang-rong-mun");
  reach(280, [d("100211")], "lam-nang-rong-mun");
  reach(200, [c("lam-nang-rong-mun"), ...p("100209", "mun", ["si-sa-ket"])], "chi-mun");
  reach(160, [c("chi-mun"), ...p("100206", "mun", ["ubon-ratchathani"])], "dom-noi-mun");
  // Sirindhorn's Dom Noi joins the Mun below Ubon; its source has no province matches.
  reach(320, [d("200212")], "dom-noi-mun");
  reach(160, [c("dom-noi-mun"), c("mun-mekong"), s("south-china-sea")]);

  current = bySystem.get("mekong");
  reach(40, [d("100201"), ...p("100201", "huai-luang", ["udon-thani"])], "huai-luang-mekong");
  reach(160, [c("huai-luang-mekong"), ...p("100201", "mekong", ["bueng-kan"])], "songkhram-mekong");
  reach(280, [d("100202")], "songkhram-mekong");
  reach(160, [c("songkhram-mekong"), ...p("100202", "mekong", ["nakhon-phanom"])], "nam-kam-mekong");
  reach(280, [d("200203"), ...p("200203", "nam-kam", ["sakon-nakhon"])], "nam-kam-mekong");
  reach(160, [c("nam-kam-mekong"), ...p("100201", "mekong", ["mukdahan"]), s("south-china-sea")]);

  current = bySystem.get("tapi");
  reach(80, [d("200603")], "phum-duang-tapi");
  reach(160, [c("phum-duang-tapi"), ...p("200603", "tapi", ["surat-thani"]), s("gulf-tapi")]);
  current = bySystem.get("pattani");
  reach(160, [d("200604"), ...p("200604", "pattani", ["yala", "pattani"]), s("gulf-pattani")]);

  current = bySystem.get("other");
  reach(80, [d("200401")], "khwae-yai-khwae-noi");
  reach(240, [d("200402")], "khwae-yai-khwae-noi");
  reach(160, [c("khwae-yai-khwae-noi"), ...p("200401", "mae-klong", ["kanchanaburi", "ratchaburi", "samut-songkhram"]), s("gulf-mae-klong")]);
  reach(80, [d("100501"), ...p("100501", "nakhon-nayok", ["nakhon-nayok"])], "bang-pakong");
  reach(240, [d("100514"), ...p("100514", "prachin-buri", ["prachin-buri"])], "bang-pakong");
  reach(160, [c("bang-pakong")], "khlong-si-yat-bang-pakong");
  reach(280, [d("100502")], "khlong-si-yat-bang-pakong");
  reach(160, [c("khlong-si-yat-bang-pakong"), ...p("100501", "bang-pakong", ["chachoengsao", "chon-buri"]), s("gulf-bang-pakong")]);
  for (const [damId, outlet] of [["100503", "bang-phra"], ["100504", "khlong-yai"], ["100505", "prasae"], ["100602", "pran-buri"], ["200601", "phetchaburi"]]) {
    reach(160, [d(damId), ...p(damId, outlet, downstream.dams[damId].provinces.map((province) => province.id)), s(`gulf-${outlet}`)]);
  }

  for (const [damId, [systemId, id, th, en]] of Object.entries(membership)) {
    const system = bySystem.get(systemId);
    let branch = system.branches.find((branch) => branch.id === id);
    if (!branch) { branch = { id, th, en, dams: [] }; system.branches.push(branch); }
    branch.dams.push(damId);
  }
  for (const system of systems) {
    system.nodes = layoutSystem(system.nodes, system.edges);
    system.edges = upstreamDamIds(system.nodes, system.edges);
  }
  return { generatedAt, source, systems };
}

export function validateSystems(data, registry, provinceRegistry, paths, downstream) {
  const fail = (message) => { throw new Error(message); };
  const equalIds = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
  const registryIds = registry.map((dam) => dam.id);
  const provinceIds = new Set(provinceRegistry.map((province) => province.id));
  const pathIds = paths.features.map((feature) => feature.properties.damId);
  if (registryIds.length !== 35 || new Set(registryIds).size !== 35) fail("Registry must contain 35 unique dams");
  if (provinceRegistry.length !== 77 || provinceIds.size !== 77) fail("Province registry must contain 77 unique provinces");
  if (!equalIds(pathIds, registryIds)) fail("dam-paths.geojson must cover registry dams 35/35 exactly");
  if (!equalIds(Object.keys(downstream.dams), registryIds)) fail("dam-downstream.json must cover registry dams 35/35 exactly");
  for (const [damId, route] of Object.entries(downstream.dams)) {
    if (!Number.isFinite(route.km) || route.km < 0) fail(`Invalid route km: ${damId}`);
    let previous = -1;
    const seen = new Set();
    for (const province of route.provinces) {
      if (!provinceIds.has(province.id)) fail(`Unknown source provinceId ${province.id}`);
      if (!Number.isFinite(province.km) || province.km < previous || province.km > route.km || seen.has(province.id)) fail(`Invalid source province km/order: ${damId}`);
      previous = province.km;
      seen.add(province.id);
    }
  }
  if (data.source !== source || !Number.isFinite(Date.parse(data.generatedAt))) fail("Invalid source/generatedAt");
  if (!equalIds(data.systems.map((system) => system.id), systemNames.map(([id]) => id))) fail("Expected five named systems plus other");
  const allNodeIds = new Set();
  const allDams = [];
  const allBranches = [];
  for (const system of data.systems) {
    const nodes = new Map(system.nodes.map((node) => [node.id, node]));
    const coordinates = new Set();
    const validKinds = new Set(["dam", "confluence", "province", "sea"]);
    const damIds = system.nodes.filter((node) => node.kind === "dam").map((node) => node.damId);
    const branches = system.branches.flatMap((branch) => branch.dams);
    if (!equalIds(damIds, branches) || new Set(branches).size !== branches.length) fail(`Branch/node dam mismatch: ${system.id}`);
    if (new Set(system.branches.map((branch) => branch.id)).size !== system.branches.length) fail(`Duplicate branch: ${system.id}`);
    for (const branch of system.branches) {
      if (!branch.id || !branch.th || !branch.en || !branch.dams.length) fail(`Invalid branch: ${system.id}`);
      for (const damId of branch.dams) {
        if (membership[damId]?.[0] !== system.id || membership[damId]?.[1] !== branch.id) fail(`Wrong membership: ${damId}`);
      }
    }
    allDams.push(...damIds);
    allBranches.push(...branches);
    for (const node of system.nodes) {
      if (!node.id || allNodeIds.has(node.id)) fail(`Duplicate/empty node id: ${node.id}`);
      allNodeIds.add(node.id);
      if (!validKinds.has(node.kind)) fail(`Invalid node kind: ${node.id}`);
      if (node.provinceId !== undefined && !provinceIds.has(node.provinceId)) fail(`Unknown provinceId ${node.provinceId}`);
      if (node.kind === "province" && !node.provinceId) fail(`Missing provinceId: ${node.id}`);
      if (node.kind === "dam" && !registryIds.includes(node.damId)) fail(`Unknown damId ${node.damId}`);
      if (node.kind !== "dam" && node.damId !== undefined) fail(`Unexpected damId: ${node.id}`);
      if (![node.x, node.y].every(Number.isFinite) || node.x < 40 || node.x > 320 || node.y < 40 || node.x % 40 || node.y % 40) fail(`Invalid schematic grid: ${node.id}`);
      const coordinate = `${node.x},${node.y}`;
      if (coordinates.has(coordinate)) fail(`Overlapping nodes: ${node.id}`);
      coordinates.add(coordinate);
    }
    const next = new Map();
    for (const edge of system.edges) {
      const from = nodes.get(edge.from);
      const to = nodes.get(edge.to);
      if (!from || !to) fail(`Dangling edge: ${edge.from} -> ${edge.to}`);
      if (next.has(edge.from)) fail(`Duplicate edge/downstream split: ${edge.from}`);
      if (from.kind === "sea") fail(`Sea has outgoing edge: ${edge.from}`);
      next.set(edge.from, edge.to);
      const dx = Math.abs(to.x - from.x);
      const dy = to.y - from.y;
      if (dy <= 0 || (dx && dx !== dy)) fail(`Edge is not downstream vertical/45 degrees: ${edge.from}`);
      for (const node of system.nodes) {
        if (node.id === from.id || node.id === to.id || node.y <= from.y || node.y >= to.y) continue;
        if ((node.x - from.x) * dy === (to.x - from.x) * (node.y - from.y)) fail(`Edge passes through unrelated node: ${node.id}`);
      }
      if (!Array.isArray(edge.damIds) || !edge.damIds.length || edge.damIds.some((id) => !damIds.includes(id))) fail(`Invalid edge damIds: ${edge.from}`);
    }
    const expected = upstreamDamIds(system.nodes, system.edges);
    for (let i = 0; i < expected.length; i++) {
      if (!equalIds(expected[i].damIds, system.edges[i].damIds)) fail(`Incorrect upstream damIds: ${system.edges[i].from}`);
    }
    for (const node of system.nodes) {
      let at = node;
      const visited = new Set();
      const routeProvinces = [];
      while (at) {
        if (visited.has(at.id)) fail(`Cycle at ${at.id}`);
        visited.add(at.id);
        if (at.kind === "province") routeProvinces.push(at.provinceId);
        if (!next.has(at.id)) break;
        at = nodes.get(next.get(at.id));
      }
      if (at?.kind !== "sea") fail(`Node does not drain to sea: ${node.id}`);
      if (node.kind === "dam") {
        // Retain every matched source province in order, even on a route clipped at 700 km.
        let index = -1;
        for (const province of downstream.dams[node.damId].provinces) {
          index = routeProvinces.indexOf(province.id, index + 1);
          if (index < 0) fail(`Lost/reordered downstream province ${province.id}: ${node.damId}`);
        }
      }
    }
  }
  if (!equalIds(allDams, registryIds) || !equalIds(allBranches, registryIds)) fail("Systems must cover registry dams 35/35 exactly");
  return `Checked ${data.systems.length} systems (5 + other): dams 35/35; provinces valid among 77; unique nodes; DAG to sea; upstream edge damIds; 45° grid`;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length && args[0] !== "--check")) throw new Error("Usage: node scripts/rivers/build-systems.mjs [--check]");
  const root = fileURLToPath(new URL("../..", import.meta.url));
  const output = join(root, "public/data/river-systems.json");
  const [downstream, paths] = await Promise.all(["dam-downstream.json", "dam-paths.geojson"].map(async (name) => JSON.parse(await readFile(join(root, "public/data", name), "utf8"))));
  const data = args.includes("--check") ? JSON.parse(await readFile(output, "utf8")) : buildSystems(downstream);
  const result = validateSystems(data, DAM_REGISTRY, provinces, paths, downstream);
  if (!args.includes("--check")) {
    await writeFile(output, JSON.stringify(data) + "\n");
    console.log(`Wrote public/data/river-systems.json (${data.systems.reduce((sum, system) => sum + system.nodes.length, 0)} nodes)`);
  }
  console.log(result);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
