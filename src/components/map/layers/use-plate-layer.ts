"use client";

import { useEffect, useState } from "react";
import type { Map } from "maplibre-gl";
import { HOLOGRAM_URL, hologramCoordinates, hologramOpacity } from "@/lib/map/hologram";
import { useStyleEffect } from "../use-style-effect";

const SOURCE = "hologram";
const LAYER = "neon-hologram";

export function usePlateLayer(map: Map | null, saveData: boolean) {
  const [idleMap, setIdleMap] = useState<Map | null>(null);
  useEffect(() => {
    if (!map || saveData) return;
    const onIdle = () => setIdleMap(map);
    map.once("idle", onIdle);
    map.triggerRepaint();
    return () => { map.off("idle", onIdle); };
  }, [map, saveData]);

  useStyleEffect(map, (live) => {
    if (saveData || idleMap !== live) return;
    const layers = live.getStyle().layers;
    const waterIndex = layers.findIndex((layer) => layer.id === "water" && layer.type === "fill");
    if (waterIndex < 0) return;
    if (!live.getSource(SOURCE)) live.addSource(SOURCE, { type: "image", url: HOLOGRAM_URL, coordinates: hologramCoordinates() });
    if (!live.getLayer(LAYER)) live.addLayer({
      id: LAYER, type: "raster", source: SOURCE,
      paint: { "raster-opacity": hologramOpacity() as ["interpolate", ["linear"], ["zoom"], number, number, number, number], "raster-resampling": "linear", "raster-fade-duration": 0 },
    }, layers[waterIndex + 1]?.id);
  }, (live) => {
    if (live.getLayer(LAYER)) live.removeLayer(LAYER);
    if (live.getSource(SOURCE)) live.removeSource(SOURCE);
  }, [idleMap, saveData]);
}
