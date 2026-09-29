"use client";

import { useEffect, useMemo } from "react";
import { LngLatBounds, type Map } from "maplibre-gl";
import type { DamPath, Downstream } from "@/lib/dams/paths";
import type { RiverStation } from "@/lib/dams/types";
import { stationSituationColor } from "@/lib/dams/thaiwater";
import { useMapContext } from "../map-provider";
import { useStyleEffect } from "../use-style-effect";

const LAYERS = ["dam-path-casing", "dam-path", "dam-path-arrows", "dam-path-stations"] as const;

export function useDamPathLayer(map: Map | null, path: DamPath | null, downstream: Downstream | null,
  stations: RiverStation[], isDesktop: boolean, reducedMotion: boolean) {
  const { theme } = useMapContext();
  const points = useMemo(() => ({
    type: "FeatureCollection" as const,
    features: downstream ? downstream.stations.flatMap(({ code }) => {
      const station = stations.find((item) => item.code === code);
      return station ? [{ type: "Feature" as const, properties: { color: stationSituationColor(station.situation) ?? "#6b7a8c" },
        geometry: { type: "Point" as const, coordinates: [station.lon, station.lat] } }] : [];
    }) : [],
  }), [downstream, stations]);

  useStyleEffect(map, (live) => {
    if (!path) return;
    if (!live.getSource("dam-path")) live.addSource("dam-path", { type: "geojson", data: path });
    if (!live.getSource("dam-path-stations")) live.addSource("dam-path-stations", { type: "geojson", data: points });
    if (!live.getLayer("dam-path-casing")) live.addLayer({ id: "dam-path-casing", type: "line", source: "dam-path",
      paint: { "line-color": theme === "light" ? "#ffffff" : "#0f1720", "line-width": 7 } });
    if (!live.getLayer("dam-path")) live.addLayer({ id: "dam-path", type: "line", source: "dam-path",
      paint: { "line-color": "#2563eb", "line-width": 3.5 } });
    if (!live.getLayer("dam-path-arrows")) live.addLayer({ id: "dam-path-arrows", type: "symbol", source: "dam-path",
      layout: { "symbol-placement": "line", "symbol-spacing": 90, "text-field": "›", "text-font": ["Noto Sans Regular"],
        "text-size": 16, "text-keep-upright": false },
      paint: { "text-color": "#2563eb", "text-halo-color": "#ffffff", "text-halo-width": 1.5 } });
    if (!live.getLayer("dam-path-stations")) live.addLayer({ id: "dam-path-stations", type: "circle", source: "dam-path-stations",
      paint: { "circle-radius": 4, "circle-color": ["get", "color"], "circle-stroke-color": "#ffffff", "circle-stroke-width": 1 } });
  }, (live) => {
    for (const id of LAYERS) if (live.getLayer(id)) live.removeLayer(id);
    for (const id of ["dam-path-stations", "dam-path"]) if (live.getSource(id)) live.removeSource(id);
  }, [path, points, theme]);

  useEffect(() => {
    if (!map || !path) return;
    const bounds = new LngLatBounds();
    for (const coordinate of path.geometry.coordinates) bounds.extend(coordinate);
    const height = map.getContainer().clientHeight;
    const sheetHeight = map.getContainer().parentElement?.querySelector<HTMLElement>(".map-sheet")?.getBoundingClientRect().height ?? 0;
    const bottom = Math.min(sheetHeight + 16, Math.max(0, height - 72 - 160));
    map.fitBounds(bounds, { padding: isDesktop ? { top: 40, right: 40, bottom: 40, left: 400 }
      : { top: 72, right: 40, bottom, left: 40 }, maxZoom: 9, duration: reducedMotion ? 0 : 800 });
  }, [map, path, isDesktop, reducedMotion]);
}
