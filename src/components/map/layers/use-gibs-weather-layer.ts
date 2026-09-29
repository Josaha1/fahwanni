"use client";

import type { Map } from "maplibre-gl";
import { gibsTileUrl } from "@/lib/map/gibs";
import { useStyleEffect } from "../use-style-effect";

export function useGibsWeatherLayer(map: Map | null, kind: "himawari" | "imerg", time: string | null, enabled: boolean): void {
  const id = `gibs-${kind}`;
  const layer = kind === "himawari" ? "Himawari_AHI_Band13_Clean_Infrared" : "IMERG_Precipitation_Rate_30min";
  useStyleEffect(map, (live) => {
    if (!enabled || !time || !live.getStyle()?.layers) return;
    if (!live.getSource(id)) live.addSource(id, { type: "raster", tiles: [gibsTileUrl(layer, time, { z: "{z}", y: "{y}", x: "{x}" }, "GoogleMapsCompatible_Level6")], tileSize: 256, maxzoom: 6,
      attribution: kind === "himawari" ? "Himawari (JMA) via NASA GIBS" : "IMERG (NASA GPM)" });
    if (!live.getLayer(id)) {
      const firstSymbol = live.getStyle().layers.find((item) => item.type === "symbol")?.id;
      live.addLayer({ id, type: "raster", source: id, paint: { "raster-opacity": kind === "himawari" ? 0.9 : 0.7, "raster-fade-duration": 0 } }, firstSymbol);
    }
  }, (live) => {
    if (live.getLayer(id)) live.removeLayer(id);
    if (live.getSource(id)) live.removeSource(id);
  }, [enabled, time]);
}
