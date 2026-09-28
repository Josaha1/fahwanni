"use client";

import { useMemo } from "react";
import type { Map } from "maplibre-gl";
import type { Quake } from "@/lib/quakes/usgs";
import { DATA } from "@/lib/map/palette";
import { useStyleEffect } from "../use-style-effect";

const SOURCE = "quakes";
type QuakeCollection = { type: "FeatureCollection"; features: { type: "Feature"; properties: { id: string; mag: number; label: string }; geometry: { type: "Point"; coordinates: [number, number] } }[] };

export function useQuakeLayer(map: Map | null, quakes: Quake[], enabled: boolean) {
  const data = useMemo<QuakeCollection>(() => ({ type: "FeatureCollection", features: enabled ? quakes.map((q) => ({ type: "Feature", properties: { id: q.id, mag: q.mag, label: `M${q.mag.toFixed(1)}` }, geometry: { type: "Point", coordinates: [q.lon, q.lat] } })) : [] }), [quakes, enabled]);

  useStyleEffect(map, (live) => {
    if (!live.getSource(SOURCE) && data.features.length) live.addSource(SOURCE, { type: "geojson", data });
    if (!live.getSource(SOURCE)) return;
    if (!live.getLayer("quake-circle")) live.addLayer({ id: "quake-circle", type: "circle", source: SOURCE, paint: {
      "circle-radius": ["interpolate", ["linear"], ["get", "mag"], 4, 5, 6, 12, 7.5, 20],
      "circle-color": DATA.quake,
      "circle-opacity": 0.8, "circle-stroke-width": 1.5, "circle-stroke-color": DATA.quake,
    } });
    if (!live.getLayer("quake-label")) live.addLayer({ id: "quake-label", type: "symbol", source: SOURCE, filter: [">=", ["get", "mag"], 5],
      layout: { "text-field": ["get", "label"], "text-offset": [0, 1.3], "text-size": 12, "text-font": ["Noto Sans Regular"] },
      paint: { "text-color": DATA.quake, "text-halo-color": DATA.quakeHalo, "text-halo-width": 1.5 } });
  }, (live) => {
    for (const id of ["quake-circle", "quake-label"]) if (live.getLayer(id)) live.removeLayer(id);
    if (live.getSource(SOURCE)) live.removeSource(SOURCE);
  }, [data]);
}
