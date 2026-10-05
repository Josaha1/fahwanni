"use client";

import { useEffect, useRef } from "react";
import type { Map } from "maplibre-gl";
import type { RadarFrame } from "@/lib/radar/types";
import { useStyleEffect } from "../use-style-effect";

const idFor = (index: number) => `rain-radar-${index}`;

export function useRadarLayer(map: Map | null, frames: RadarFrame[], maxZoom: number, activeIndex: number, enabled: boolean, opacity = 0.7) {
  const visibility = useRef({ activeIndex, enabled, opacity });
  useEffect(() => { visibility.current = { activeIndex, enabled, opacity }; }, [activeIndex, enabled, opacity]);

  useStyleEffect(map, (live) => {
    const layers = live.getStyle()?.layers;
    if (!layers) return;
    const firstSymbol = layers.find((layer) => layer.type === "symbol")?.id;
    frames.forEach((frame, index) => {
      const id = idFor(index);
      if (!live.getSource(id)) live.addSource(id, { type: "raster", tiles: [frame.tileUrl], tileSize: 256, maxzoom: maxZoom });
      if (!live.getLayer(id)) live.addLayer({ id, type: "raster", source: id, paint: { "raster-opacity": 0, "raster-opacity-transition": { duration: 0 }, "raster-saturation": 0.35, "raster-contrast": 0.15, "raster-resampling": "linear" } }, firstSymbol);
      const nextOpacity = visibility.current.enabled && index === visibility.current.activeIndex ? visibility.current.opacity : 0;
      if (live.getPaintProperty(id, "raster-opacity") !== nextOpacity) live.setPaintProperty(id, "raster-opacity", nextOpacity);
    });
  }, (live) => {
    for (let index = 0; index < frames.length; index++) {
      const id = idFor(index);
      if (live.getLayer(id)) live.removeLayer(id);
      if (live.getSource(id)) live.removeSource(id);
    }
  }, [frames, maxZoom]);

  useEffect(() => {
    if (!map) return;
    frames.forEach((_, index) => {
      const id = idFor(index);
      if (!map.getLayer(id)) return;
      const nextOpacity = enabled && index === activeIndex ? opacity : 0;
      if (map.getPaintProperty(id, "raster-opacity") !== nextOpacity) map.setPaintProperty(id, "raster-opacity", nextOpacity);
    });
  }, [map, frames, activeIndex, enabled, opacity]);
}
