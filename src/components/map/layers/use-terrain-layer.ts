"use client";

import { useEffect } from "react";
import type { Map } from "maplibre-gl";
import { HILLSHADE_LAYER, TERRAIN_SOURCE, terrainCamera, terrainSource } from "@/lib/map/terrain";
import { useStyleEffect } from "../use-style-effect";

export function useTerrainLayer(map: Map | null, enabled: boolean, reducedMotion: boolean) {
  useStyleEffect(map, (live) => {
    if (enabled) {
      const layers = live.getStyle()?.layers;
      if (!layers) return;
      if (!live.getSource(TERRAIN_SOURCE)) live.addSource(TERRAIN_SOURCE, terrainSource);
      if (!live.getLayer(HILLSHADE_LAYER)) {
        const firstSymbol = layers.find((layer) => layer.type === "symbol")?.id;
        live.addLayer({ id: HILLSHADE_LAYER, type: "hillshade", source: TERRAIN_SOURCE, paint: { "hillshade-exaggeration": 0.35 } }, firstSymbol);
      }
      if (!live.getTerrain()) live.setTerrain({ source: TERRAIN_SOURCE, exaggeration: 1.3 });
    } else {
      if (live.getTerrain()) live.setTerrain(null);
      if (live.getLayer(HILLSHADE_LAYER)) live.removeLayer(HILLSHADE_LAYER);
    }
  }, (live) => {
    if (live.getTerrain()) live.setTerrain(null);
    if (live.getLayer(HILLSHADE_LAYER)) live.removeLayer(HILLSHADE_LAYER);
    if (live.getSource(TERRAIN_SOURCE)) live.removeSource(TERRAIN_SOURCE);
  }, [enabled]);

  useEffect(() => {
    if (!map) return;
    map.easeTo({ ...terrainCamera(enabled, reducedMotion), bearing: enabled ? map.getBearing() : 0 });
  }, [map, enabled, reducedMotion]);
}
