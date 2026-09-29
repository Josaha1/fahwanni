"use client";

import { useMemo } from "react";
import type { Map } from "maplibre-gl";
import type { DamsPayload } from "@/lib/dams/client";
import { damBandColor } from "@/lib/dams/bands";
import { useT } from "@/i18n/client";
import { BASE } from "@/lib/map/base-style";
import { DATA } from "@/lib/map/palette";
import { useMapContext } from "../map-provider";
import { useStyleEffect } from "../use-style-effect";

const SOURCE = "dams";
const LAYERS = ["dam-high", "dam-circle", "dam-label"] as const;
const RADIUS = ["interpolate", ["linear"], ["sqrt", ["max", 0, ["get", "capacity"]]], 10, 6, Math.sqrt(13462), 16] as
  ["interpolate", ["linear"], ["sqrt", ["max", 0, ["get", "capacity"]]], number, number, number, number];

type DamCollection = { type: "FeatureCollection"; features: {
  type: "Feature";
  properties: { id: string; band: number; color: string; capacity: number; high: 0 | 1; name: string };
  geometry: { type: "Point"; coordinates: [number, number] };
}[] };

export function useDamsLayer(map: Map | null, dams: DamsPayload | null, enabled: boolean, waterDay = 0) {
  const t = useT();
  const { theme } = useMapContext();
  const data = useMemo<DamCollection>(() => ({
    type: "FeatureCollection",
    features: enabled ? (dams?.dams ?? []).map((dam) => ({
      type: "Feature", properties: {
        id: dam.id, band: dam.band, color: damBandColor(dam.band), capacity: dam.capacityMcm,
        high: dam.highRelease ? 1 : 0, name: t.locale === "en" ? dam.nameEn || dam.nameTh : dam.nameTh,
      }, geometry: { type: "Point", coordinates: [dam.lon, dam.lat] },
    })) : [],
  }), [dams, enabled, t.locale]);

  useStyleEffect(map, (live) => {
    if (!live.getSource(SOURCE) && data.features.length) live.addSource(SOURCE, { type: "geojson", data });
    if (!live.getSource(SOURCE)) return;
    if (!live.getLayer("dam-high")) live.addLayer({ id: "dam-high", type: "circle", source: SOURCE,
      filter: ["==", ["get", "high"], 1], paint: {
        "circle-radius": ["+", RADIUS, 5], "circle-color": "rgba(0, 0, 0, 0)",
        "circle-stroke-width": 3, "circle-stroke-color": DATA.storm,
      } });
    if (!live.getLayer("dam-circle")) live.addLayer({ id: "dam-circle", type: "circle", source: SOURCE, paint: {
      "circle-radius": RADIUS, "circle-color": ["get", "color"], "circle-opacity": waterDay > 0 ? 0.45 : 0.95,
      "circle-stroke-width": 2, "circle-stroke-color": theme === "light" ? "#ffffff" : "#0f1720",
    } });
    if (!live.getLayer("dam-label")) live.addLayer({ id: "dam-label", type: "symbol", source: SOURCE, minzoom: 7,
      layout: { "text-field": ["get", "name"], "text-font": ["Noto Sans Regular"], "text-size": 11, "text-offset": [0, 1.6] },
      paint: { "text-color": BASE[theme].label, "text-halo-color": BASE[theme].halo, "text-halo-width": 1.5 } });
  }, (live) => {
    for (const id of LAYERS) if (live.getLayer(id)) live.removeLayer(id);
    if (live.getSource(SOURCE)) live.removeSource(SOURCE);
  }, [data, theme, waterDay]);
}
