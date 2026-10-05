"use client";

import { useEffect, useRef } from "react";
import type { FillExtrusionLayerSpecification, GeoJSONSource, Map } from "maplibre-gl";
import { floodWaterLayer, waterGrid, wetBandLayer } from "@/lib/map/flood-sim";
import { useStyleEffect } from "../use-style-effect";

function gridForView(map: Map) {
  const bounds = map.getBounds();
  return waterGrid({ west: bounds.getWest(), south: bounds.getSouth(), east: bounds.getEast(), north: bounds.getNorth() });
}

function updatePaint(map: Map, depth: number) {
  for (const layer of [floodWaterLayer(depth), wetBandLayer(depth)]) {
    if (!map.getLayer(layer.id)) continue;
    const paint = layer.paint ?? {};
    for (const property of Object.keys(paint) as (keyof NonNullable<FillExtrusionLayerSpecification["paint"]>)[]) {
      const value = paint[property];
      if (JSON.stringify(map.getPaintProperty(layer.id, property)) !== JSON.stringify(value)) {
        map.setPaintProperty(layer.id, property, value);
      }
    }
  }
}

export function useFloodDepthLayer(map: Map | null, enabled: boolean, depth: number): void {
  const latestDepth = useRef(depth);

  // Depth changes must keep the source and layers alive; style reloads read the latest value.
  useEffect(() => {
    latestDepth.current = depth;
    if (map && enabled) updatePaint(map, depth);
  }, [map, enabled, depth]);

  useStyleEffect(map, (live) => {
    if (!enabled || !live.getStyle()?.layers) return;
    if (!live.getSource("flood-grid")) live.addSource("flood-grid", { type: "geojson", data: gridForView(live) });
    const before = live.getLayer("buildings-3d") ? "buildings-3d"
      : live.getStyle().layers.find((layer) => layer.type === "symbol")?.id;
    for (const layer of [floodWaterLayer(latestDepth.current), wetBandLayer(latestDepth.current)]) {
      if (!live.getLayer(layer.id)) live.addLayer(layer, before);
      // The buildings hook may recreate its layer independently after a theme change.
      const layers = live.getStyle().layers;
      if (before && layers.findIndex((item) => item.id === layer.id) > layers.findIndex((item) => item.id === before)) {
        live.moveLayer(layer.id, before);
      }
    }
    updatePaint(live, latestDepth.current);
  }, (live) => {
    for (const id of ["flood-wet-band", "flood-water"]) if (live.getLayer(id)) live.removeLayer(id);
    if (live.getSource("flood-grid")) live.removeSource("flood-grid");
  }, [enabled]);

  useEffect(() => {
    if (!map || !enabled) return;
    const update = () => {
      const source = map.getSource("flood-grid") as GeoJSONSource | undefined;
      if (source) source.setData(gridForView(map));
    };
    map.on("moveend", update);
    return () => { map.off("moveend", update); };
  }, [map, enabled]);
}
