import type { FillExtrusionLayerSpecification } from "maplibre-gl";
import { BASE, type BaseTheme } from "./base-style";

export function buildings3dLayer(theme: BaseTheme): FillExtrusionLayerSpecification {
  return {
    id: "buildings-3d", type: "fill-extrusion", source: "openmaptiles", "source-layer": "building", minzoom: 14,
    paint: {
      "fill-extrusion-color": BASE[theme].roadDim,
      "fill-extrusion-height": ["coalesce", ["get", "render_height"], 5],
      "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
    },
  };
}
