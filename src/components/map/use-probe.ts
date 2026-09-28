"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Marker, type Map, type MapMouseEvent } from "maplibre-gl";

export type Probe = { kind: "point"; lat: number; lon: number } | { kind: "storm"; id: string } | { kind: "quake"; id: string };

export function useProbe(map: Map | null) {
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
      const layers = ["quake-circle", "storm-cone", "storm-track", "storm-forecast"].filter((id) => map.getLayer(id));
      const features = layers.length ? map.queryRenderedFeatures(event.point, { layers }) : [];
      const quake = features.find((feature) => feature.layer?.id === "quake-circle" && typeof feature.properties?.id === "string");
      const storm = features.find((feature) => feature.layer?.id.startsWith("storm-") && typeof feature.properties?.id === "string");
      if (quake) select({ kind: "quake", id: quake.properties!.id as string });
      else if (storm) select({ kind: "storm", id: storm.properties!.id as string });
      else select({ kind: "point", lat: event.lngLat.lat, lon: event.lngLat.lng });
    };
    map.on("click", onClick);
    return () => { map.off("click", onClick); };
  }, [map, select]);

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
