"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { GeoJSONSource, Map } from "maplibre-gl";
import { FLOOD_RISK_COLORS, FLOOD_RISK_MAX_SPAN, FLOOD_RISK_MIN_ZOOM, type FloodRiskPoint } from "@/lib/water/flood-risk";
import { useMapContext } from "../map-provider";
import { useStyleEffect } from "../use-style-effect";

const SOURCE = "flood-risk";
const LAYER = "flood-risk-circle";
const MAX_POINTS = 20_000;

export type FloodRiskState = { points: globalThis.Map<string, FloodRiskPoint>; status: "idle" | "zoom-in" | "loading" | "ready" | "error" };

/** DDPM village flood-risk points, loaded per viewport from zoom 9 (historical risk, not a current flood). */
export function useFloodRiskLayer(map: Map | null, enabled: boolean): FloodRiskState {
  const { theme } = useMapContext();
  const [state, setState] = useState<FloodRiskState>({ points: new globalThis.Map(), status: "idle" });
  const requested = useRef(new Set<string>());

  useEffect(() => {
    if (!map || !enabled) return;
    let active = true;
    const load = () => {
      if (map.getZoom() < FLOOD_RISK_MIN_ZOOM) { setState((current) => ({ ...current, status: "zoom-in" })); return; }
      const bounds = map.getBounds();
      const west = Math.max(bounds.getWest(), bounds.getCenter().lng - FLOOD_RISK_MAX_SPAN / 2 + 0.01);
      const east = Math.min(bounds.getEast(), bounds.getCenter().lng + FLOOD_RISK_MAX_SPAN / 2 - 0.01);
      const south = Math.max(bounds.getSouth(), bounds.getCenter().lat - FLOOD_RISK_MAX_SPAN / 2 + 0.01);
      const north = Math.min(bounds.getNorth(), bounds.getCenter().lat + FLOOD_RISK_MAX_SPAN / 2 - 0.01);
      const bbox = [west, south, east, north].map((value) => value.toFixed(3)).join(",");
      const snapped = [Math.floor(west * 4), Math.floor(south * 4), Math.ceil(east * 4), Math.ceil(north * 4)].join(",");
      if (requested.current.has(snapped)) { setState((current) => ({ ...current, status: "ready" })); return; }
      requested.current.add(snapped);
      setState((current) => ({ ...current, status: "loading" }));
      fetch(`/api/flood-risk?bbox=${bbox}`).then((response) => response.ok ? response.json() as Promise<{ points?: FloodRiskPoint[] }> : Promise.reject(new Error(String(response.status))))
        .then((data) => {
          if (!active) return;
          setState((current) => {
            const points = new globalThis.Map(current.points);
            for (const point of data.points ?? []) points.set(point.id, point);
            while (points.size > MAX_POINTS) points.delete(points.keys().next().value!);
            return { points, status: "ready" };
          });
        })
        .catch(() => { requested.current.delete(snapped); if (active) setState((current) => ({ ...current, status: "error" })); });
    };
    load();
    map.on("moveend", load);
    return () => { active = false; map.off("moveend", load); };
  }, [map, enabled]);

  const data = useMemo(() => ({ type: "FeatureCollection" as const, features: enabled ? [...state.points.values()].map((point) => ({
    type: "Feature" as const, properties: { id: point.id, color: FLOOD_RISK_COLORS[point.level], level: point.level },
    geometry: { type: "Point" as const, coordinates: [point.lon, point.lat] as [number, number] },
  })) : [] }), [state.points, enabled]);

  useStyleEffect(map, (live) => {
    if (!data.features.length) return;
    if (!live.getSource(SOURCE)) live.addSource(SOURCE, { type: "geojson", data, attribution: "ความเสี่ยงอุทกภัย: กรมป้องกันและบรรเทาสาธารณภัย (CC BY)" });
    else (live.getSource(SOURCE) as GeoJSONSource).setData(data);
    const before = ["reservoir-cluster", "dam-high", "dam-circle"].find((id) => live.getLayer(id));
    if (!live.getLayer(LAYER)) live.addLayer({ id: LAYER, type: "circle", source: SOURCE, minzoom: FLOOD_RISK_MIN_ZOOM - 0.5, paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, 2.5, 13, 6], "circle-color": ["get", "color"], "circle-opacity": 0.85,
      "circle-stroke-width": 0.8, "circle-stroke-color": theme === "light" ? "#ffffff" : "#0f1720",
    } }, before);
  }, (live) => {
    if (live.getLayer(LAYER)) live.removeLayer(LAYER);
    if (live.getSource(SOURCE)) live.removeSource(SOURCE);
  }, [data, theme]);

  return state;
}
