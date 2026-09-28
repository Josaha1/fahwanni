import type { LayerSpecification, StyleSpecification } from "maplibre-gl";
import { NEON } from "./neon-palette";

type LineLayer = Extract<LayerSpecification, { type: "line" }>;

const GLOW_IDS = new Set([
  "boundary_country_z0-4",
  "boundary_country_z5-",
  "waterway",
  "highway_motorway_inner",
]);

function glowWidth(width: NonNullable<LineLayer["paint"]>["line-width"]) {
  if (typeof width === "number") return width * 4;
  if (Array.isArray(width) && width[0] === "interpolate" && width.length >= 5) {
    return width.map((part, index) => index >= 4 && index % 2 === 0 && typeof part === "number" ? part * 4 : part) as typeof width;
  }
  return 6;
}

function glowLayer(line: LineLayer): LineLayer {
  const width = glowWidth(line.paint?.["line-width"]);
  return {
    ...line,
    id: `neon-glow-${line.id}`,
    paint: {
      ...line.paint,
      "line-color": line.paint?.["line-color"] ?? NEON.border,
      "line-width": width,
      "line-blur": width,
      "line-opacity": 0.35,
    },
  };
}

export function neonStyle(base: StyleSpecification): StyleSpecification {
  const style = structuredClone(base);
  const layers: LayerSpecification[] = [];

  for (const layer of style.layers) {
    if (layer.type === "background") {
      layer.paint = { ...layer.paint, "background-color": NEON.bg };
    } else if (layer.type === "fill") {
      if (layer.id === "water") {
        layer.paint = { ...layer.paint, "fill-color": NEON.water };
      } else if (layer.id.startsWith("landcover_") || layer.id.startsWith("landuse_")) {
        layer.paint = {
          ...layer.paint,
          "fill-color": layer.id.includes("wood") || layer.id.includes("park") ? NEON.landAlt : NEON.land,
          "fill-opacity": 0.35,
        };
        delete layer.paint["fill-pattern"];
      } else if (layer.id === "building") {
        layer.paint = { ...layer.paint, "fill-color": NEON.roadDim, "fill-opacity": 0.6 };
      } else if (layer.id.startsWith("road_")) {
        layer.paint = { ...layer.paint, "fill-color": NEON.roadDim };
      }
    } else if (layer.type === "line") {
      let color: string | undefined;
      if (layer.id === "waterway") color = NEON.river;
      else if (layer.id === "boundary_state") color = NEON.labelMuted;
      else if (layer.id.startsWith("boundary_country_")) color = NEON.border;
      else if (layer.id === "highway_motorway_inner") color = NEON.river;
      else if (layer.id === "highway_major_inner") color = NEON.road;
      else if (layer.id.startsWith("highway_") || layer.id.startsWith("road_") || layer.id.startsWith("railway") || layer.id.startsWith("aeroway-")) color = NEON.roadDim;
      if (color) layer.paint = { ...layer.paint, "line-color": color };
      if (layer.id.startsWith("boundary_country_")) {
        layer.paint = {
          ...layer.paint,
          "line-width": ["interpolate", ["linear"], ["zoom"], 3, 1, 22, 1.5],
          "line-blur": 0,
          "line-opacity": 1,
        };
      }
      if (layer.id === "highway_motorway_inner") {
        layer.paint = { ...layer.paint, "line-opacity": 0.9 };
      }
    } else if (layer.type === "symbol") {
      const prominent = /^place_(country|state|city)/.test(layer.id);
      layer.paint = {
        ...layer.paint,
        "text-color": prominent ? NEON.label : NEON.labelMuted,
        "text-halo-color": NEON.halo,
        "text-halo-width": 1.4,
      };
    }

    if (layer.type === "line" && GLOW_IDS.has(layer.id)) layers.push(glowLayer(layer));
    layers.push(layer);
    if (layer.id === "water" && layer.type === "fill") {
      layers.push({
        id: "neon-coast-glow",
        type: "line",
        source: "openmaptiles",
        "source-layer": "water",
        paint: { "line-color": NEON.coast, "line-width": 4, "line-blur": 4, "line-opacity": 0.35 },
      });
      layers.push({
        id: "neon-coast",
        type: "line",
        source: "openmaptiles",
        "source-layer": "water",
        paint: { "line-color": NEON.coast, "line-width": 1 },
      });
    }
  }

  style.layers = layers;
  style.sky = {
    "sky-color": NEON.sky.sky,
    "horizon-color": NEON.sky.horizon,
    "fog-color": NEON.sky.fog,
    "sky-horizon-blend": 0.5,
    "horizon-fog-blend": 0.6,
    "fog-ground-blend": 0.4,
    "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 1, 10, 0],
  };
  return style;
}
