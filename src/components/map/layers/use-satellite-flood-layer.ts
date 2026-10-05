"use client";

import type { Map } from "maplibre-gl";
import { gibsTileUrl } from "@/lib/map/gibs";
import type { FloodReport } from "@/lib/map/gibs-replay";
import { useStyleEffect } from "../use-style-effect";

const ID = "sat-flood";

export function useSatelliteFloodLayer(map: Map | null, enabled: boolean, report: FloodReport | null): void {
  const date = report?.date;
  const layer = report?.layer;

  useStyleEffect(map, (live) => {
    if (!enabled || !date || !layer || !live.getStyle()?.layers) return;
    if (!live.getSource(ID)) live.addSource(ID, { type: "raster", tiles: [gibsTileUrl(layer, date, { z: "{z}", y: "{y}", x: "{x}" })], tileSize: 256, maxzoom: 9,
      attribution: "NASA LANCE/GIBS" });
    if (!live.getLayer(ID)) {
      const waterLayers = new Set(["all-routes", "dam-path-casing", "dam-path", "dam-path-flow", "river-circle", "rain-risk-circle", "rain-accum", "dam-high", "dam-circle"]);
      const before = live.getStyle().layers.find((item) => waterLayers.has(item.id))?.id
        ?? live.getStyle().layers.find((item) => item.type === "symbol")?.id;
      live.addLayer({ id: ID, type: "raster", source: ID, paint: { "raster-opacity": 0.85, "raster-fade-duration": 0 } }, before);
    }
  }, (live) => {
    if (live.getLayer(ID)) live.removeLayer(ID);
    if (live.getSource(ID)) live.removeSource(ID);
  }, [enabled, date, layer]);
}
