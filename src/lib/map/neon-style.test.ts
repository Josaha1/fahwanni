import type { LayerSpecification, StyleSpecification } from "maplibre-gl";
import { describe, expect, it } from "vitest";
import ofmDark from "./fixture-ofm-dark.json";
import { contrastRatio } from "./palette";
import { NEON, neonStyle } from "./neon-style";

const base = ofmDark as StyleSpecification;
const glowIds = ["boundary_country_z0-4", "boundary_country_z5-", "highway_motorway_inner"];

describe("neon contrast", () => {
  it.each([
    ["label on halo", NEON.label, NEON.halo, 4.5],
    ["label on background", NEON.label, NEON.bg, 4.5],
    ["muted label on background", NEON.labelMuted, NEON.bg, 3],
    ["border on background", NEON.border, NEON.bg, 3],
  ])("keeps %s above %s:1", (_name, foreground, background, minimum) => {
    expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(minimum);
  });
});

function layer(style: StyleSpecification, id: string): LayerSpecification {
  const found = style.layers.find((item) => item.id === id);
  if (!found) throw new Error(`Missing layer: ${id}`);
  return found;
}

describe("neonStyle", () => {
  it("clones the fixture and preserves its resources and metadata", () => {
    const snapshot = structuredClone(base);
    const result = neonStyle(base);
    expect(base).toEqual(snapshot);
    expect(result).not.toBe(base);
    expect(result.sources).toEqual(base.sources);
    expect(result.sources).not.toBe(base.sources);
    expect(result.glyphs).toEqual(base.glyphs);
    expect(result.sprite).toEqual(base.sprite);
    expect(result.name).toEqual(base.name);
    expect(result.version).toBe(base.version);
    expect(result.layers).toHaveLength(base.layers.length + 3 + 2);
    expect(new Set(result.layers.map((item) => item.id)).size).toBe(result.layers.length);
  });

  it("puts three matching glow layers immediately below their crisp lines", () => {
    const result = neonStyle(base);
    for (const id of glowIds) {
      const index = result.layers.findIndex((item) => item.id === id);
      const crisp = layer(result, id);
      const glow = result.layers[index - 1];
      expect(glow.id).toBe(`neon-glow-${id}`);
      if (glow.type !== "line" || crisp.type !== "line") throw new Error(`Expected line pair: ${id}`);
      for (const key of ["source", "source-layer", "filter", "minzoom", "maxzoom"] as const) {
        expect(glow[key]).toEqual(crisp[key]);
      }
      expect(glow.paint?.["line-color"]).toEqual(crisp.paint?.["line-color"]);
      expect(glow.paint?.["line-opacity"]).toBe(0.35);
      expect(glow.paint?.["line-blur"]).toEqual(glow.paint?.["line-width"]);
    }
    const motorway = layer(result, "neon-glow-highway_motorway_inner");
    if (motorway.type !== "line") throw new Error("Expected motorway glow line");
    expect(motorway.paint?.["line-width"]).toEqual(["interpolate", ["exponential", 1.4], ["zoom"], 4, 8, 6, 5.2, 20, 120]);
    const border = layer(result, "neon-glow-boundary_country_z0-4");
    if (border.type !== "line") throw new Error("Expected border glow line");
    expect(border.paint?.["line-width"]).toEqual(["interpolate", ["linear"], ["zoom"], 3, 4, 22, 6]);
  });

  it("excludes maritime boundaries from crisp and glow country lines", () => {
    const result = neonStyle(base);
    for (const id of ["boundary_country_z0-4", "boundary_country_z5-"]) {
      const original = layer(base, id);
      const crisp = layer(result, id);
      const glow = layer(result, `neon-glow-${id}`);
      if (original.type !== "line" || crisp.type !== "line" || glow.type !== "line") throw new Error(`Expected country lines: ${id}`);
      const expectedFilter = ["all", original.filter, ["!=", ["get", "maritime"], 1]];
      expect(crisp.filter).toEqual(expectedFilter);
      expect(glow.filter).toEqual(expectedFilter);
    }
  });

  it("adds coast lines immediately after water and recolors the base", () => {
    const result = neonStyle(base);
    const waterIndex = result.layers.findIndex((item) => item.id === "water");
    expect(result.layers.slice(waterIndex + 1, waterIndex + 3).map((item) => item.id)).toEqual(["neon-coast-glow", "neon-coast"]);
    for (const id of ["neon-coast-glow", "neon-coast"]) {
      const coast = layer(result, id);
      if (coast.type !== "line") throw new Error(`Expected coast line: ${id}`);
      expect(coast.source).toBe("openmaptiles");
      expect(coast["source-layer"]).toBe("water");
      expect(coast.paint?.["line-color"]).toBe(NEON.coast);
    }
    expect(layer(result, "background")).toMatchObject({ paint: { "background-color": NEON.bg } });
    expect(layer(result, "water")).toMatchObject({ paint: { "fill-color": NEON.water } });
    expect(layer(result, "waterway")).toMatchObject({ paint: { "line-color": "#1f5d9c", "line-opacity": 0.7 } });
    expect(result.layers.some((item) => item.id === "neon-glow-waterway")).toBe(false);
    expect(layer(result, "building")).toMatchObject({ paint: { "fill-color": NEON.roadDim, "fill-opacity": 0.6 } });
    expect(layer(result, "highway_motorway_inner")).toMatchObject({ paint: { "line-color": NEON.river, "line-opacity": 0.9 } });
    expect(layer(result, "boundary_state")).toMatchObject({ paint: { "line-color": NEON.labelMuted, "line-dasharray": [2, 2] } });
  });

  it("styles every symbol without changing its font", () => {
    const result = neonStyle(base);
    for (const original of base.layers.filter((item) => item.type === "symbol")) {
      const symbol = layer(result, original.id);
      if (symbol.type !== "symbol") throw new Error(`Expected symbol: ${original.id}`);
      expect(symbol.layout?.["text-font"]).toEqual(original.layout?.["text-font"]);
      expect(symbol.paint?.["text-color"]).toBe(/^place_(country|state|city)/.test(original.id) ? NEON.label : NEON.labelMuted);
      expect(symbol.paint?.["text-halo-color"]).toBe(NEON.halo);
      expect(symbol.paint?.["text-halo-width"]).toBeGreaterThanOrEqual(1.2);
    }
  });

  it("adds sky with the supported MapLibre keys", () => {
    expect(neonStyle(base).sky).toEqual({
      "sky-color": NEON.sky.sky,
      "horizon-color": NEON.sky.horizon,
      "fog-color": NEON.sky.fog,
      "sky-horizon-blend": 0.5,
      "horizon-fog-blend": 0.6,
      "fog-ground-blend": 0.4,
      "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 1, 10, 0],
    });
  });
});
