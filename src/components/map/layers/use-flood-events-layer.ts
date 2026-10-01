"use client";

import { useMemo } from "react";
import type { GeoJSONSource, Map } from "maplibre-gl";
import { ALERT_COLORS, type FloodEventsPayload } from "@/components/water/flood-events";
import { useMapContext } from "../map-provider";
import { useStyleEffect } from "../use-style-effect";

const SOURCE = "flood-events";
const LAYERS = ["flood-event-halo", "flood-event-circle"] as const;

/** Flood/disaster events (GDACS, GLIDE): a ring per event, coloured by GDACS alert level (blue when none). */
export function useFloodEventsLayer(map: Map | null, payload: FloodEventsPayload | null, enabled: boolean) {
  const { theme } = useMapContext();
  const data = useMemo(() => ({ type: "FeatureCollection" as const, features: enabled ? (payload?.items ?? []).map((event) => ({
    type: "Feature" as const, properties: { id: event.id, color: event.alert ? ALERT_COLORS[event.alert] : "#3b82f6" },
    geometry: { type: "Point" as const, coordinates: [event.lon, event.lat] as [number, number] },
  })) : [] }), [payload, enabled]);

  useStyleEffect(map, (live) => {
    if (!data.features.length) return;
    if (!live.getSource(SOURCE)) live.addSource(SOURCE, { type: "geojson", data, attribution: "GDACS · GLIDE/ADRC via HDX (CC BY-IGO)" });
    else (live.getSource(SOURCE) as GeoJSONSource).setData(data);
    const before = live.getStyle().layers.find((layer) => layer.type === "symbol")?.id;
    if (!live.getLayer("flood-event-halo")) live.addLayer({ id: "flood-event-halo", type: "circle", source: SOURCE, paint: {
      "circle-radius": 14, "circle-color": ["get", "color"], "circle-opacity": 0.18,
    } }, before);
    if (!live.getLayer("flood-event-circle")) live.addLayer({ id: "flood-event-circle", type: "circle", source: SOURCE, paint: {
      "circle-radius": 7, "circle-color": theme === "light" ? "#ffffff" : "#0f1720",
      "circle-stroke-width": 3, "circle-stroke-color": ["get", "color"],
    } }, before);
  }, (live) => {
    for (const id of LAYERS) if (live.getLayer(id)) live.removeLayer(id);
    if (live.getSource(SOURCE)) live.removeSource(SOURCE);
  }, [data, theme]);
}
