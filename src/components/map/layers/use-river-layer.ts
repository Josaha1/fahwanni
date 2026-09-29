"use client";

import { useMemo } from "react";
import type { Map } from "maplibre-gl";
import { useT } from "@/i18n/client";
import { BASE } from "@/lib/map/base-style";
import { riverColors } from "@/lib/rivers/colors";
import { riverAtDay } from "@/lib/rivers/status";
import type { RiversPayload } from "@/components/water/river-details";
import { useMapContext } from "../map-provider";
import { useStyleEffect } from "../use-style-effect";

const SOURCE = "rivers";
const LAYERS = ["river-circle", "river-label"] as const;

export function useRiverLayer(map: Map | null, rivers: RiversPayload | null, enabled: boolean, waterDay: number) {
  const { theme } = useMapContext();
  const t = useT();
  const data = useMemo(() => ({ type: "FeatureCollection" as const, features: enabled ? (rivers?.points ?? []).flatMap((point) => {
    const selected = riverAtDay(point.summary, waterDay);
    if (!selected || !point.summary) return [];
    const next = riverAtDay(point.summary, Math.min(7, waterDay + 1));
    const trend = waterDay === 0 ? point.summary.trend : next && next.value > selected.value * 1.1 ? "rising" : next && next.value < selected.value * 0.9 ? "falling" : "steady";
    const name = t.locale === "en" ? point.nameEn.split(" at ")[0] : point.nameTh.split(" ")[0];
    return [{ type: "Feature" as const, properties: {
      id: point.id, color: riverColors[selected.status], label: `${name} ${trend === "rising" ? "↗" : trend === "falling" ? "↘" : "→"}`,
    }, geometry: { type: "Point" as const, coordinates: [point.lon, point.lat] } }];
  }) : [] }), [rivers, enabled, waterDay, t.locale]);

  useStyleEffect(map, (live) => {
    if (!live.getSource(SOURCE) && data.features.length) live.addSource(SOURCE, { type: "geojson", data });
    if (!live.getSource(SOURCE)) return;
    const before = live.getLayer("dam-circle") ? "dam-circle" : undefined;
    if (!live.getLayer(LAYERS[0])) live.addLayer({ id: LAYERS[0], type: "circle", source: SOURCE, paint: {
      "circle-radius": 7, "circle-color": BASE[theme].bg,
      "circle-stroke-width": 3, "circle-stroke-color": ["get", "color"],
    } }, before);
    if (!live.getLayer(LAYERS[1])) live.addLayer({ id: LAYERS[1], type: "symbol", source: SOURCE, minzoom: 6,
      layout: { "text-field": ["get", "label"], "text-font": ["Noto Sans Regular"], "text-size": 11, "text-offset": [0, 1.7] },
      paint: { "text-color": BASE[theme].label, "text-halo-color": BASE[theme].halo, "text-halo-width": 1.5 },
    }, before);
  }, (live) => {
    for (const id of LAYERS) if (live.getLayer(id)) live.removeLayer(id);
    if (live.getSource(SOURCE)) live.removeSource(SOURCE);
  }, [data, theme]);
}
