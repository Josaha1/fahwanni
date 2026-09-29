"use client";

import { useMemo } from "react";
import type { Map } from "maplibre-gl";
import type { RainRisk } from "@/lib/rain-risk/tmd";
import { BASE } from "@/lib/map/base-style";
import { useMapContext } from "../map-provider";
import { useStyleEffect } from "../use-style-effect";

const SOURCE = "rain-risk";
const LAYERS = ["rain-risk-circle", "rain-risk-label"] as const;

export function useRainRiskLayer(map: Map | null, risk: RainRisk | null, enabled: boolean) {
  const { theme } = useMapContext();
  const data = useMemo(() => ({ type: "FeatureCollection" as const, features: enabled ? (risk?.stations ?? []).map((item) => ({
    type: "Feature" as const, properties: { id: item.id, rainMm: item.rainMm, category: item.category, label: `${item.rainMm} มม.` },
    geometry: { type: "Point" as const, coordinates: [item.lon, item.lat] },
  })) : [] }), [risk, enabled]);
  useStyleEffect(map, (live) => {
    if (!live.getSource(SOURCE) && data.features.length) live.addSource(SOURCE, { type: "geojson", data });
    if (!live.getSource(SOURCE)) return;
    const before = live.getLayer("dam-circle") ? "dam-circle" : undefined;
    if (!live.getLayer(LAYERS[0])) live.addLayer({ id: LAYERS[0], type: "circle", source: SOURCE, paint: {
      "circle-radius": ["match", ["get", "category"], "veryHeavy", 11, 8],
      "circle-color": ["match", ["get", "category"], "veryHeavy", "#6b21a8", "#a855f7"],
      "circle-stroke-width": 2, "circle-stroke-color": theme === "light" ? "#ffffff" : "#0f1720",
    } }, before);
    if (!live.getLayer(LAYERS[1])) live.addLayer({ id: LAYERS[1], type: "symbol", source: SOURCE, minzoom: 7,
      layout: { "text-field": ["get", "label"], "text-font": ["Noto Sans Regular"], "text-size": 11, "text-offset": [0, 1.8] },
      paint: { "text-color": BASE[theme].label, "text-halo-color": BASE[theme].halo, "text-halo-width": 1.5 },
    }, before);
  }, (live) => {
    for (const id of LAYERS) if (live.getLayer(id)) live.removeLayer(id);
    if (live.getSource(SOURCE)) live.removeSource(SOURCE);
  }, [data, theme]);
}
