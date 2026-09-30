"use client";

import type { Map } from "maplibre-gl";
import { surfaceWaterTileUrl } from "@/lib/map/surface-water";
import { useStyleEffect } from "../use-style-effect";

const ID = "surface-water-occurrence";

export function useSurfaceWaterLayer(map: Map | null, enabled: boolean): void {
  useStyleEffect(map, (live) => {
    if (!enabled || !live.getStyle()?.layers) return;
    if (!live.getSource(ID)) live.addSource(ID, { type: "raster", tiles: [surfaceWaterTileUrl({ z: "{z}", y: "{y}", x: "{x}" })],
      tileSize: 256, maxzoom: 12, attribution: "EC JRC/Google Global Surface Water" });
    if (!live.getLayer(ID)) {
      const before = live.getLayer("sat-flood") ? "sat-flood"
        : live.getStyle().layers.find((item) => item.type === "symbol")?.id;
      live.addLayer({ id: ID, type: "raster", source: ID,
        paint: { "raster-opacity": 0.6, "raster-fade-duration": 0 } }, before);
    }
  }, (live) => {
    if (live.getLayer(ID)) live.removeLayer(ID);
    if (live.getSource(ID)) live.removeSource(ID);
  }, [enabled]);
}
