"use client";

import type { Map } from "maplibre-gl";
import { reliefCoordinates, reliefOpacity, reliefUrl } from "@/lib/map/relief";
import { useMapContext } from "../map-provider";
import { useStyleEffect } from "../use-style-effect";

const SOURCE = "relief";
const LAYER = "relief";

export function usePlateLayer(map: Map | null, saveData: boolean) {
  const { theme } = useMapContext();

  // The provider supplies the map after load, so relief can be added before raster tiles settle.
  useStyleEffect(map, (live) => {
    if (saveData) return;
    const layers = live.getStyle()?.layers;
    if (!layers) return;
    const waterIndex = layers.findIndex((layer) => layer.id === "water" && layer.type === "fill");
    if (waterIndex < 0) return;
    if (!live.getSource(SOURCE)) live.addSource(SOURCE, { type: "image", url: reliefUrl(theme), coordinates: reliefCoordinates() });
    if (!live.getLayer(LAYER)) live.addLayer({
      id: LAYER, type: "raster", source: SOURCE,
      paint: { "raster-opacity": reliefOpacity(theme), "raster-resampling": "linear", "raster-fade-duration": 0 },
    }, layers[waterIndex + 1]?.id);
  }, (live) => {
    if (live.getLayer(LAYER)) live.removeLayer(LAYER);
    if (live.getSource(SOURCE)) live.removeSource(SOURCE);
  }, [saveData, theme]);
}
