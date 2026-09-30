"use client";

import type { Map } from "maplibre-gl";
import { floodDate, thermalTileUrl } from "@/lib/map/gibs";
import { useStyleEffect } from "../use-style-effect";

const ID = "thermal-anomalies";

export function useThermalAnomaliesLayer(map: Map | null, enabled: boolean, nowMs: number): void {
  const date = floodDate(nowMs);
  useStyleEffect(map, (live) => {
    if (!enabled || !live.getStyle()?.layers) return;
    if (!live.getSource(ID)) live.addSource(ID, { type: "raster", tiles: [thermalTileUrl(date)],
      tileSize: 256, minzoom: 0, maxzoom: 9, attribution: "NASA FIRMS/GIBS" });
    if (!live.getLayer(ID)) {
      const firstSymbol = live.getStyle().layers.find((item) => item.type === "symbol")?.id;
      live.addLayer({ id: ID, type: "raster", source: ID,
        paint: { "raster-opacity": 1, "raster-fade-duration": 0 } }, firstSymbol);
    }
  }, (live) => {
    if (live.getLayer(ID)) live.removeLayer(ID);
    if (live.getSource(ID)) live.removeSource(ID);
  }, [enabled, date]);
}
