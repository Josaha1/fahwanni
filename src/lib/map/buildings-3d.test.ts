import { validateStyleMin } from "@maplibre/maplibre-gl-style-spec";
import { describe, expect, it } from "vitest";
import { BASE } from "./base-style";
import { buildings3dLayer } from "./buildings-3d";

describe("buildings3dLayer", () => {
  it.each(["light", "dark"] as const)("styles %s buildings with valid OpenMapTiles heights", (theme) => {
    const layer = buildings3dLayer(theme);
    expect(layer).toMatchObject({
      id: "buildings-3d", type: "fill-extrusion", source: "openmaptiles", "source-layer": "building", minzoom: 14,
      paint: {
        "fill-extrusion-color": BASE[theme].roadDim,
        "fill-extrusion-height": ["coalesce", ["get", "render_height"], 5],
        "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
      },
    });
    expect(validateStyleMin({
      version: 8,
      sources: { openmaptiles: { type: "vector", tiles: ["https://example.com/{z}/{x}/{y}.pbf"] } },
      layers: [layer],
    })).toEqual([]);
  });
});
