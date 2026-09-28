"use client";

import { useEffect, useMemo } from "react";
import { Marker, type Map } from "maplibre-gl";
import { stormsToGeoJSON, type StormCollection } from "@/lib/storms/geojson";
import type { Storm } from "@/lib/storms/normalize";
import { stormCategoryLabel } from "@/lib/storms/present";
import { DATA } from "@/lib/map/palette";
import { useT } from "@/i18n/client";
import { useStyleEffect } from "../use-style-effect";

const SOURCE = "storms";
const LAYERS = ["storm-cone", "storm-track", "storm-forecast", "storm-label"] as const;

export function useStormLayer(map: Map | null, storms: Storm[], enabled: boolean, onSelect?: (id: string, trigger: HTMLElement) => void) {
  const t = useT();
  const data = useMemo<StormCollection>(() => enabled ? stormsToGeoJSON(storms) : { type: "FeatureCollection", features: [] }, [storms, enabled]);

  useStyleEffect(map, (live) => {
    if (!live.getSource(SOURCE) && data.features.length) live.addSource(SOURCE, { type: "geojson", data });
    if (!live.getSource(SOURCE)) return;
    if (!live.getLayer("storm-cone")) live.addLayer({ id: "storm-cone", type: "fill", source: SOURCE, filter: ["==", ["get", "kind"], "cone"], paint: { "fill-color": DATA.storm, "fill-opacity": 0.12 } });
    if (!live.getLayer("storm-track")) live.addLayer({ id: "storm-track", type: "line", source: SOURCE, filter: ["==", ["get", "kind"], "track"], paint: { "line-color": DATA.storm, "line-width": 2.5 } });
    if (!live.getLayer("storm-forecast")) live.addLayer({ id: "storm-forecast", type: "line", source: SOURCE, filter: ["==", ["get", "kind"], "forecast"], paint: { "line-color": DATA.storm, "line-width": 2, "line-dasharray": [2, 2] } });
    if (!live.getLayer("storm-label")) live.addLayer({ id: "storm-label", type: "symbol", source: SOURCE, filter: ["==", ["get", "kind"], "center"], layout: { "text-field": ["get", "name"], "text-offset": [0, 2.7], "text-size": 13, "text-font": ["Noto Sans Regular"] }, paint: { "text-color": DATA.storm, "text-halo-color": DATA.stormHalo, "text-halo-width": 1.5 } });
  }, (live) => {
    for (const id of LAYERS) if (live.getLayer(id)) live.removeLayer(id);
    if (live.getSource(SOURCE)) live.removeSource(SOURCE);
  }, [data]);

  useEffect(() => {
    if (!map || !enabled) return;
    const markers = storms.map((storm) => {
      const element = document.createElement("div");
      element.className = "neon-typhoon";
      element.setAttribute("role", "button");
      element.tabIndex = 0;
      element.setAttribute("aria-label", t("{category} {name}", { category: stormCategoryLabel(storm, t), name: storm.name }));
      element.addEventListener("click", (event) => { event.stopPropagation(); onSelect?.(storm.id, element); });
      element.addEventListener("keydown", (event) => {
        if (event.key === "Enter") { event.preventDefault(); onSelect?.(storm.id, element); }
      });
      return new Marker({ element, anchor: "center" }).setLngLat([storm.position.lon, storm.position.lat]).addTo(map);
    });
    return () => markers.forEach((marker) => marker.remove());
  }, [map, storms, enabled, t, onSelect]);
}
