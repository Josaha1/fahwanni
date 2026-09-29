"use client";

import { useEffect, useState } from "react";
import type { Map, MapEventType } from "maplibre-gl";
import { floodDate, gibsTileUrl, type FloodLayer } from "@/lib/map/gibs";
import { useStyleEffect } from "../use-style-effect";

const ID = "sat-flood";
const VIIRS: FloodLayer = "VIIRS_Combined_Flood_2-Day";
const MODIS: FloodLayer = "MODIS_Combined_Flood_2-Day";

export function useSatelliteFloodLayer(map: Map | null, enabled: boolean, nowMs: number): void {
  const date = floodDate(nowMs);
  const [fallback, setFallback] = useState<{ date: string; enabled: boolean }>({ date, enabled: false });
  const layer = fallback.date === date && fallback.enabled ? MODIS : VIIRS;

  useEffect(() => {
    if (!map || !enabled || layer === MODIS) return;
    let consecutiveErrors = 0;
    const onError = (event: MapEventType["error"]) => {
      if ("sourceId" in event && event.sourceId === ID && ++consecutiveErrors >= 2) setFallback({ date, enabled: true });
    };
    const onData = (event: MapEventType["sourcedata"]) => {
      if (event.sourceId === ID && event.sourceDataType === "content" && event.tile) consecutiveErrors = 0;
    };
    map.on("error", onError);
    map.on("sourcedata", onData);
    return () => { map.off("error", onError); map.off("sourcedata", onData); };
  }, [map, enabled, date, layer]);

  useStyleEffect(map, (live) => {
    if (!enabled || !live.getStyle()?.layers) return;
    if (!live.getSource(ID)) live.addSource(ID, { type: "raster", tiles: [gibsTileUrl(layer, date, { z: "{z}", y: "{y}", x: "{x}" })], tileSize: 256, maxzoom: 9 });
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
