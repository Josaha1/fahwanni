"use client";

import { useMemo } from "react";
import type { GeoJSONSource, Map } from "maplibre-gl";
import { useT } from "@/i18n/client";
import { BASE } from "@/lib/map/base-style";
import { reservoirColor, RESERVOIR_GREY, type ReservoirPoint } from "@/lib/dams/reservoirs";
import { useMapContext } from "../map-provider";
import { useStyleEffect } from "../use-style-effect";

const SOURCE = "reservoirs";
const MINOR = "osm-minor";
export const RESERVOIR_LAYERS = ["reservoir-cluster", "reservoir-cluster-count", "reservoir-point", "reservoir-label", "osm-minor-point"] as const;
const ATTRIBUTION = "อ่าง: กรมทรัพยากรน้ำ (CC BY) · เขื่อน: © OpenStreetMap contributors (ODbL)";

/** DWR reservoirs + named OSM dams (clustered); unnamed OSM dams only from zoom 10. RID's 35 dams draw above. */
export function useReservoirsLayer(map: Map | null, points: ReservoirPoint[] | null, enabled: boolean, nowMs: number) {
  const t = useT();
  const { theme } = useMapContext();
  const { main, minor } = useMemo(() => {
    const feature = (point: ReservoirPoint) => ({ type: "Feature" as const,
      properties: { id: point.id, color: reservoirColor(point, nowMs), name: t.locale === "en" ? point.nameEn || point.nameTh : point.nameTh },
      geometry: { type: "Point" as const, coordinates: [point.lon, point.lat] as [number, number] } });
    const list = enabled ? points ?? [] : [];
    return {
      main: { type: "FeatureCollection" as const, features: list.filter((point) => point.source === "dwr" || point.nameTh).map(feature) },
      minor: { type: "FeatureCollection" as const, features: list.filter((point) => point.source === "osm" && !point.nameTh).map(feature) },
    };
  }, [points, enabled, nowMs, t.locale]);

  useStyleEffect(map, (live) => {
    if (!main.features.length && !minor.features.length) return;
    const before = live.getLayer("dam-high") ? "dam-high" : live.getLayer("dam-circle") ? "dam-circle" : undefined;
    if (!live.getSource(MINOR)) live.addSource(MINOR, { type: "geojson", data: minor, attribution: ATTRIBUTION });
    else (live.getSource(MINOR) as GeoJSONSource).setData(minor);
    if (!live.getSource(SOURCE)) live.addSource(SOURCE, { type: "geojson", data: main, cluster: true, clusterMaxZoom: 8, clusterRadius: 50, attribution: ATTRIBUTION });
    else (live.getSource(SOURCE) as GeoJSONSource).setData(main);
    if (!live.getLayer("osm-minor-point")) live.addLayer({ id: "osm-minor-point", type: "circle", source: MINOR, minzoom: 10, paint: {
      "circle-radius": 3, "circle-color": RESERVOIR_GREY, "circle-stroke-width": 1, "circle-stroke-color": BASE[theme].bg,
    } }, before);
    if (!live.getLayer("reservoir-cluster")) live.addLayer({ id: "reservoir-cluster", type: "circle", source: SOURCE, filter: ["has", "point_count"], paint: {
      "circle-radius": ["step", ["get", "point_count"], 10, 20, 13, 80, 17], "circle-color": BASE[theme].bg,
      "circle-stroke-width": 2, "circle-stroke-color": RESERVOIR_GREY, "circle-opacity": 0.9,
    } }, before);
    if (!live.getLayer("reservoir-cluster-count")) live.addLayer({ id: "reservoir-cluster-count", type: "symbol", source: SOURCE, filter: ["has", "point_count"],
      layout: { "text-field": ["get", "point_count_abbreviated"], "text-font": ["Noto Sans Regular"], "text-size": 10, "text-allow-overlap": true },
      paint: { "text-color": BASE[theme].label } }, before);
    if (!live.getLayer("reservoir-point")) live.addLayer({ id: "reservoir-point", type: "circle", source: SOURCE, filter: ["!", ["has", "point_count"]], paint: {
      "circle-radius": 4.5, "circle-color": ["get", "color"], "circle-stroke-width": 1.5, "circle-stroke-color": theme === "light" ? "#ffffff" : "#0f1720",
    } }, before);
    if (!live.getLayer("reservoir-label")) live.addLayer({ id: "reservoir-label", type: "symbol", source: SOURCE, minzoom: 9, filter: ["!", ["has", "point_count"]],
      layout: { "text-field": ["get", "name"], "text-font": ["Noto Sans Regular"], "text-size": 10, "text-offset": [0, 1.2], "text-optional": true },
      paint: { "text-color": BASE[theme].label, "text-halo-color": BASE[theme].halo, "text-halo-width": 1.2 } }, before);
  }, (live) => {
    for (const id of RESERVOIR_LAYERS) if (live.getLayer(id)) live.removeLayer(id);
    for (const id of [SOURCE, MINOR]) if (live.getSource(id)) live.removeSource(id);
  }, [main, minor, theme]);
}
