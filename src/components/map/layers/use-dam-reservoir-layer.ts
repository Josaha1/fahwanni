"use client";

import { useMemo } from "react";
import type { Map } from "maplibre-gl";
import type { FeatureCollection, Polygon } from "geojson";
import { capacityColor } from "@/components/dams/dam-hero";
import { useStyleEffect } from "../use-style-effect";

export type DamReservoirGeo = { reservoir: { role: string; coordinates: [number, number][] }[] };

export function reservoirPolygons(geo: DamReservoirGeo | null): FeatureCollection<Polygon> {
  const rings = geo?.reservoir ?? [];
  // OSM multipolygons can contain separate outer rings and islands. Assign holes to their containing outer.
  const contains = (ring: [number, number][], point: [number, number]) => {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [x, y] = ring[i];
      const [px, py] = ring[j];
      if ((y > point[1]) !== (py > point[1]) && point[0] < (px - x) * (point[1] - y) / (py - y) + x) inside = !inside;
    }
    return inside;
  };
  return { type: "FeatureCollection", features: rings.filter((ring) => ring.role === "outer" && ring.coordinates.length >= 4).map((outer) => ({
    type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [outer.coordinates,
      ...rings.filter((ring) => ring.role === "inner" && ring.coordinates.length >= 4 && contains(outer.coordinates, ring.coordinates[0])).map((ring) => ring.coordinates)] },
  })) };
}

export function useDamReservoirLayer(map: Map | null, geo: DamReservoirGeo | null, pct: number | null) {
  const data = useMemo(() => reservoirPolygons(geo), [geo]);
  useStyleEffect(map, (live) => {
    if (!data.features.length) return;
    const color = getComputedStyle(document.documentElement).getPropertyValue(capacityColor(pct).slice(4, -1)).trim() || "#64748b";
    if (!live.getSource("dam-reservoir")) live.addSource("dam-reservoir", { type: "geojson", data, attribution: "© OpenStreetMap contributors (ODbL)" });
    const before = ["dam-path-casing", "dam-circle"].find((id) => live.getLayer(id));
    if (!live.getLayer("dam-reservoir-fill")) live.addLayer({ id: "dam-reservoir-fill", type: "fill", source: "dam-reservoir", paint: { "fill-color": color, "fill-opacity": 0.6 } }, before);
  }, (live) => {
    if (live.getLayer("dam-reservoir-fill")) live.removeLayer("dam-reservoir-fill");
    if (live.getSource("dam-reservoir")) live.removeSource("dam-reservoir");
  }, [data, pct]);
}
