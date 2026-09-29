"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Marker, type Map, type MapMouseEvent } from "maplibre-gl";

export type Probe = { kind: "point"; lat: number; lon: number } | { kind: "storm"; id: string } | { kind: "quake"; id: string } | { kind: "dam"; id: string } | { kind: "rain"; id: string } | { kind: "river"; id: string };

/** `points: false` (water mode): a tap on empty map opens nothing; dam, storm and quake taps still work. */
export function useProbe(map: Map | null, { points }: { points: boolean } = { points: true }) {
  const [probe, setProbe] = useState<Probe | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const select = useCallback((next: Probe, trigger?: HTMLElement | null) => {
    opener.current = trigger ?? null;
    setProbe(next);
  }, []);
  const close = useCallback(() => {
    setProbe(null);
    const target = opener.current ?? map?.getContainer();
    opener.current = null;
    requestAnimationFrame(() => target?.focus());
  }, [map]);
  const probeCenter = useCallback((trigger?: HTMLElement | null) => {
    if (!map) return;
    const center = map.getCenter();
    select({ kind: "point", lat: center.lat, lon: center.lng }, trigger);
  }, [map, select]);

  useEffect(() => {
    if (!map) return;
    const container = map.getContainer();
    container.tabIndex = -1;
    const onClick = (event: MapMouseEvent) => {
      const dam = map.getLayer("dam-circle") ? map.queryRenderedFeatures([
        [event.point.x - 8, event.point.y - 8], [event.point.x + 8, event.point.y + 8],
      ], { layers: ["dam-circle"] }).find((feature) => typeof feature.properties?.id === "string") : undefined;
      const rain = map.getLayer("rain-risk-circle") ? map.queryRenderedFeatures([
        [event.point.x - 8, event.point.y - 8], [event.point.x + 8, event.point.y + 8],
      ], { layers: ["rain-risk-circle"] }).find((feature) => typeof feature.properties?.id === "string") : undefined;
      const river = map.getLayer("river-circle") ? map.queryRenderedFeatures([
        [event.point.x - 8, event.point.y - 8], [event.point.x + 8, event.point.y + 8],
      ], { layers: ["river-circle"] }).find((feature) => typeof feature.properties?.id === "string") : undefined;
      const layers = ["quake-circle", "storm-cone", "storm-track", "storm-forecast"].filter((id) => map.getLayer(id));
      const features = layers.length ? map.queryRenderedFeatures(event.point, { layers }) : [];
      const quake = features.find((feature) => feature.layer?.id === "quake-circle" && typeof feature.properties?.id === "string");
      const storm = features.find((feature) => feature.layer?.id.startsWith("storm-") && typeof feature.properties?.id === "string");
      if (dam) select({ kind: "dam", id: dam.properties!.id as string });
      else if (rain) select({ kind: "rain", id: rain.properties!.id as string });
      else if (river) select({ kind: "river", id: river.properties!.id as string });
      else if (quake) select({ kind: "quake", id: quake.properties!.id as string });
      else if (storm) select({ kind: "storm", id: storm.properties!.id as string });
      else if (points) select({ kind: "point", lat: event.lngLat.lat, lon: event.lngLat.lng });
    };
    map.on("click", onClick);
    return () => { map.off("click", onClick); };
  }, [map, select, points]);

  useEffect(() => {
    if (!map || probe?.kind !== "point") return;
    const element = document.createElement("div");
    element.className = "map-probe-marker";
    const marker = new Marker({ element, anchor: "center" }).setLngLat([probe.lon, probe.lat]).addTo(map);
    return () => { marker.remove(); };
  }, [map, probe]);

  useEffect(() => {
    if (!probe) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); close(); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [probe, close]);

  return { probe, select, close, probeCenter };
}
