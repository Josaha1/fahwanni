import type { LayerSpecification, StyleSpecification } from "maplibre-gl";

type LineLayer = Extract<LayerSpecification, { type: "line" }>;

export const BASE = {
  light: {
    bg: "#eef1f5", water: "#c9dcef", land: "#e9ecef", landAlt: "#dfe8dc",
    roadDim: "#ffffff", road: "#f4d9a6", border: "#7b8794", state: "#b6bfca",
    waterway: "#a9c6e4", label: "#1f2937", labelMuted: "#5b6573", halo: "#ffffff",
    panel: "rgba(255, 255, 255, 0.92)", panelBorder: "rgba(15, 23, 42, 0.10)",
    sky: { sky: "#cfe3f7", horizon: "#eef1f5", fog: "#e6ebf1" },
  },
  dark: {
    bg: "#0f1720", water: "#16283b", land: "#131d28", landAlt: "#15232b",
    roadDim: "#1f2a36", road: "#2b3847", border: "#6b7a8c", state: "#3a4756",
    waterway: "#24425f", label: "#e5e9f0", labelMuted: "#9aa6b5", halo: "#0b1118",
    panel: "rgba(15, 23, 32, 0.92)", panelBorder: "rgba(255, 255, 255, 0.10)",
    sky: { sky: "#1b2a3d", horizon: "#0f1720", fog: "#131d28" },
  },
} as const;

export type BaseTheme = "light" | "dark";

export function mapThemeFor(appTheme: string | undefined): BaseTheme {
  return appTheme === "light" ? "light" : "dark";
}

export const STYLE_URLS = {
  light: "https://tiles.openfreemap.org/styles/positron",
  dark: "https://tiles.openfreemap.org/styles/dark",
} as const;

export function baseStyle(theme: BaseTheme, source: StyleSpecification): StyleSpecification {
  const style = structuredClone(source);
  const colors = BASE[theme];

  for (const layer of style.layers) {
    if (layer.type === "background") {
      layer.paint = { ...layer.paint, "background-color": colors.bg };
    } else if (layer.type === "fill") {
      if (layer.id === "water") {
        layer.paint = { ...layer.paint, "fill-color": colors.water };
      } else if (layer.id.startsWith("landcover_") || layer.id.startsWith("landuse_")) {
        layer.paint = {
          ...layer.paint,
          "fill-color": layer.id.includes("wood") || layer.id.includes("park") ? colors.landAlt : colors.land,
          "fill-opacity": 0.35,
        };
        delete layer.paint["fill-pattern"];
      } else if (layer.id === "building") {
        layer.paint = { ...layer.paint, "fill-color": colors.roadDim, "fill-opacity": 0.6 };
      } else if (layer.id.startsWith("road_")) {
        layer.paint = { ...layer.paint, "fill-color": colors.roadDim };
      }
    } else if (layer.type === "line") {
      let color: string | undefined;
      if (layer.id === "waterway") color = colors.waterway;
      else if (layer.id === "boundary_state") color = colors.state;
      else if (layer.id.startsWith("boundary_country_")) color = colors.border;
      else if (layer.id === "highway_motorway_inner") color = colors.waterway;
      else if (layer.id === "highway_major_inner") color = colors.road;
      else if (layer.id.startsWith("highway_") || layer.id.startsWith("road_") || layer.id.startsWith("railway") || layer.id.startsWith("aeroway-")) color = colors.roadDim;
      if (color) layer.paint = { ...layer.paint, "line-color": color };
      if (layer.id === "waterway") layer.paint = { ...layer.paint, "line-opacity": 0.7 };
      if (layer.id.startsWith("boundary_country_")) {
        layer.filter = layer.filter
          ? ["all", layer.filter, ["!=", ["get", "maritime"], 1]] as LineLayer["filter"]
          : ["!=", ["get", "maritime"], 1];
        layer.paint = {
          ...layer.paint,
          "line-width": ["interpolate", ["linear"], ["zoom"], 3, 1, 22, 1.5],
          "line-opacity": 1,
        };
      }
      if (layer.id === "highway_motorway_inner") layer.paint = { ...layer.paint, "line-opacity": 0.9 };
      if (layer.paint) delete layer.paint["line-blur"];
    } else if (layer.type === "symbol") {
      const prominent = /^place_(country|state|city)/.test(layer.id);
      layer.paint = {
        ...layer.paint,
        "text-color": prominent ? colors.label : colors.labelMuted,
        "text-halo-color": colors.halo,
        "text-halo-width": 1.4,
      };
    }
  }

  style.sky = {
    "sky-color": colors.sky.sky,
    "horizon-color": colors.sky.horizon,
    "fog-color": colors.sky.fog,
    "sky-horizon-blend": 0.5,
    "horizon-fog-blend": 0.6,
    "fog-ground-blend": 0.4,
    "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 1, 10, 0],
  };
  return style;
}
