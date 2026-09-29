import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import points from "../../public/data/river-points.json" with { type: "json" };
import { upstreamDamsOf } from "./upstream.mjs";

const geo = JSON.parse(readFileSync(new URL("../../public/data/dam-paths.geojson", import.meta.url), "utf8"));
const paths = geo.features.map((feature) => ({ damId: feature.properties.damId, coordinates: feature.geometry.coordinates }));
const point = (id) => points.points.find((item) => item.id === id);

describe("upstreamDamsOf", () => {
  it("finds Bhumibol and Sirikit above the Chao Phraya at Nakhon Sawan", () => {
    const ids = upstreamDamsOf(point("chaophraya-nakhonsawan"), paths).map((dam) => dam.damId);
    expect(ids).toEqual(expect.arrayContaining(["200101", "200102"]));
  });

  it("finds no big dam above the Ping at Chiang Mai", () => {
    expect(upstreamDamsOf(point("ping-chiangmai"), paths).map((dam) => dam.damId)).not.toContain("200101");
  });

  it("orders dams by river distance and ignores far routes", () => {
    const found = upstreamDamsOf({ lat: 0, lon: 0 }, [{ damId: "far", coordinates: [[10, 10], [10.1, 10.1]] }]);
    expect(found).toEqual([]);
    const both = upstreamDamsOf({ lat: 0, lon: 0.05 }, [
      { damId: "a", coordinates: [[-1, 0], [1, 0]] },
      { damId: "b", coordinates: [[0, 0], [1, 0]] },
    ]);
    expect(both.map((dam) => dam.damId)).toEqual(["b", "a"]);
  });
});
