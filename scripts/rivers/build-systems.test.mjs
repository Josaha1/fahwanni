import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { DAM_REGISTRY } from "../../src/lib/dams/registry.ts";
import { provinces } from "../../src/lib/provinces.ts";
import { buildSystems, layoutSystem, upstreamDamIds, validateSystems } from "./build-systems.mjs";

const readData = (name) => JSON.parse(readFileSync(new URL(`../../public/data/${name}`, import.meta.url), "utf8"));
const downstream = readData("dam-downstream.json");
const paths = readData("dam-paths.geojson");
const generatedAt = "2026-10-06T00:00:00.000Z";
const build = () => buildSystems(downstream, DAM_REGISTRY, generatedAt);
const validate = (data, geo = paths, routes = downstream) => validateSystems(data, DAM_REGISTRY, provinces, geo, routes);
const systemOf = (data, id) => data.systems.find((system) => system.id === id);
const edgeOf = (system, from) => system.edges.find((edge) => edge.from === `${system.id}:${from}`);

const mergeNodes = [
  { id: "a", kind: "dam", damId: "a", x: 40 },
  { id: "b", kind: "dam", damId: "b", x: 40 },
  { id: "c", kind: "dam", damId: "c", x: 200 },
  { id: "join", kind: "confluence", x: 120 },
  { id: "sea", kind: "sea", x: 120 },
];
const mergeEdges = [{ from: "a", to: "b" }, { from: "b", to: "join" }, { from: "c", to: "join" }, { from: "join", to: "sea" }];

describe("river system pure functions", () => {
  it("collects cascaded upstream dams after a merge without mutating inputs", () => {
    const before = structuredClone({ mergeNodes, mergeEdges });
    expect(upstreamDamIds(mergeNodes, mergeEdges).map((edge) => edge.damIds)).toEqual([["a"], ["a", "b"], ["c"], ["a", "b", "c"]]);
    expect({ mergeNodes, mergeEdges }).toEqual(before);
  });

  it("deduplicates an ancestor reaching a merge by two paths", () => {
    const nodes = [{ id: "a", kind: "dam", damId: "a" }, { id: "left", kind: "confluence" }, { id: "right", kind: "confluence" }, { id: "join", kind: "confluence" }, { id: "sea", kind: "sea" }];
    const edges = [{ from: "a", to: "left" }, { from: "a", to: "right" }, { from: "left", to: "join" }, { from: "right", to: "join" }, { from: "join", to: "sea" }];
    expect(upstreamDamIds(nodes, edges).at(-1).damIds).toEqual(["a"]);
  });

  it("rejects cycles, dangling edges and duplicate nodes", () => {
    expect(() => upstreamDamIds(mergeNodes, [...mergeEdges, { from: "join", to: "a" }])).toThrow(/Cycle/);
    expect(() => upstreamDamIds(mergeNodes, [{ from: "missing", to: "sea" }])).toThrow(/Dangling/);
    expect(() => upstreamDamIds([...mergeNodes, mergeNodes[0]], mergeEdges)).toThrow(/Duplicate/);
  });

  it("lays out vertical and 45 degree edges within a 390 px panel", () => {
    const nodes = layoutSystem(mergeNodes, mergeEdges);
    const byId = new Map(nodes.map((node) => [node.id, node]));
    for (const edge of mergeEdges) {
      const from = byId.get(edge.from);
      const to = byId.get(edge.to);
      expect(to.y).toBeGreaterThan(from.y);
      const dx = Math.abs(to.x - from.x);
      if (dx) expect(to.y - from.y).toBe(dx);
      expect(from.x).toBeLessThan(390);
    }
    expect(mergeNodes.every((node) => node.y === undefined)).toBe(true);
  });

  it("keeps disconnected outlets apart and rejects a non-sea sink or cycle", () => {
    const nodes = layoutSystem([{ id: "a", kind: "dam", x: 160 }, { id: "a-sea", kind: "sea", x: 160 }, { id: "b", kind: "dam", x: 160 }, { id: "b-sea", kind: "sea", x: 160 }], [{ from: "a", to: "a-sea" }, { from: "b", to: "b-sea" }]);
    expect(nodes[2].y).toBeGreaterThan(nodes[1].y);
    expect(() => layoutSystem(mergeNodes, [])).toThrow(/does not end at sea/);
    expect(() => layoutSystem(mergeNodes, [{ from: "a", to: "b" }, { from: "b", to: "a" }])).toThrow(/Cycle/);
  });
});

describe("authored river systems and check", () => {
  it("builds deterministically, validates 35/35 and matches the generated artifact", () => {
    const data = build();
    expect(build()).toEqual(data);
    expect(validate(data)).toContain("dams 35/35");
    const artifact = readData("river-systems.json");
    expect({ ...artifact, generatedAt }).toEqual(data);
    expect(data.systems.map((system) => system.id)).toEqual(["chao-phraya", "chi-mun", "mekong", "tapi", "pattani", "other"]);
  });

  it("keeps western/eastern standalone rivers outside the five main systems", () => {
    const other = systemOf(build(), "other");
    expect(other.branches.flatMap((branch) => branch.dams)).toHaveLength(10);
    expect(edgeOf(other, "gulf-mae-klong")).toBeUndefined();
    const maeKlong = other.edges.find((edge) => edge.to === "other:gulf-mae-klong");
    expect(maeKlong.damIds).toEqual(["200401", "200402"]);
    for (const damId of ["100503", "100505", "100602"]) {
      expect(edgeOf(other, `dam-${damId}`).damIds).toEqual([damId]);
    }
  });

  it("includes cascades and separates Tha Chin from the Chao Phraya outlet", () => {
    const system = systemOf(build(), "chao-phraya");
    expect(edgeOf(system, "dam-100106").damIds).toEqual(["100106"]);
    expect(edgeOf(system, "dam-100105").damIds).toEqual(["100105", "100106"]);
    expect(edgeOf(system, "dam-200101").damIds).toEqual(["100104", "200101", "200103"]);
    const gulf = system.edges.find((edge) => edge.to === "chao-phraya:gulf-chao-phraya");
    expect(gulf.damIds).toHaveLength(10);
    expect(gulf.damIds).not.toContain("100303");
    expect(system.edges.find((edge) => edge.to === "chao-phraya:gulf-tha-chin").damIds).toEqual(["100303"]);
  });

  it("adds Sirindhorn below Ubon and preserves distinct upstream Mun joins", () => {
    const system = systemOf(build(), "chi-mun");
    expect(edgeOf(system, "mun-ubon-ratchathani").damIds).not.toContain("200212");
    expect(edgeOf(system, "dom-noi-mun").damIds).toHaveLength(9);
    expect(edgeOf(system, "lam-chae-mun").damIds).toEqual(["100209", "100210"]);
    expect(edgeOf(system, "lam-phra-phloeng-mun").damIds).toEqual(["100208", "100209", "100210"]);
    expect(edgeOf(system, "lam-takhong-mun").damIds).not.toContain("100211");
  });

  it("rejects missing/unknown paths and unknown province ids", () => {
    expect(() => validate(build(), { ...paths, features: paths.features.slice(1) })).toThrow(/35\/35/);
    const unknown = structuredClone(paths);
    unknown.features[0].properties.damId = "unknown";
    expect(() => validate(build(), unknown)).toThrow(/35\/35/);
    const data = build();
    data.systems[0].nodes[0].provinceId = "unknown";
    expect(() => validate(data)).toThrow(/Unknown provinceId/);
  });

  it("rejects duplicate nodes, omitted dams and invalid membership", () => {
    const duplicate = build();
    duplicate.systems[0].nodes.push({ ...duplicate.systems[0].nodes.find((node) => node.kind === "province") });
    expect(() => validate(duplicate)).toThrow(/Duplicate/);
    const missing = build();
    missing.systems[0].branches[0].dams.pop();
    expect(() => validate(missing)).toThrow(/mismatch/);
    const wrong = build();
    wrong.systems[0].branches[0].id = "wrong-river";
    expect(() => validate(wrong)).toThrow(/membership/);
  });

  it("rejects missing or repeated upstream edge dams and dangling edges", () => {
    const missing = build();
    missing.systems[0].edges.find((edge) => edge.damIds.length > 1).damIds.pop();
    expect(() => validate(missing)).toThrow(/Incorrect upstream/);
    const repeated = build();
    const edge = repeated.systems[0].edges[0];
    edge.damIds.push(edge.damIds[0]);
    expect(() => validate(repeated)).toThrow(/Incorrect upstream/);
    const dangling = build();
    dangling.systems[0].edges[0].to = "missing";
    expect(() => validate(dangling)).toThrow(/Dangling/);
  });

  it("rejects cycles, dead ends, bad schematic coordinates and source province order", () => {
    const cyclic = build();
    cyclic.systems[0].edges.push({ from: "chao-phraya:gulf-chao-phraya", to: cyclic.systems[0].nodes[0].id, damIds: ["200101"] });
    expect(() => validate(cyclic)).toThrow(/Sea has outgoing/);
    const dead = build();
    dead.systems[0].edges = dead.systems[0].edges.filter((edge) => edge.to !== "chao-phraya:gulf-chao-phraya");
    expect(() => validate(dead)).toThrow(/does not drain to sea/);
    const badGrid = build();
    badGrid.systems[0].nodes[0].x = 400;
    expect(() => validate(badGrid)).toThrow(/schematic grid/);
    const reversed = structuredClone(downstream);
    reversed.dams["200101"].provinces.reverse();
    expect(() => validate(build(), paths, reversed)).toThrow(/km\/order/);
  });

  it("rejects dropping a valid source province from a dam's downstream route", () => {
    const data = build();
    systemOf(data, "pattani").nodes.find((node) => node.kind === "province").provinceId = "bangkok";
    expect(() => validate(data)).toThrow(/Lost\/reordered downstream province yala/);
  });
});
