"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Marker, type GeoJSONSource, type Map, type MapMouseEvent } from "maplibre-gl";

export type Probe = { kind: "point"; lat: number; lon: number } | { kind: "storm"; id: string } | { kind: "quake"; id: string } | { kind: "dam"; id: string } | { kind: "rain"; id: string } | { kind: "river"; id: string } | { kind: "reservoir"; id: string } | { kind: "floodEvent"; id: string } | { kind: "floodRisk"; id: string };

/** `points: false` (water mode): empty taps do not open a point probe. */
/** `onRoute`: a tap on the all-routes overview opens that route's dam and hands its id back to focus the route. */
export function useProbe(map: Map | null, { points, onRoute }: { points: boolean; onRoute?: (damId: string) => void } = { points: true }) {
  const routeHandler = useRef(onRoute);
  useEffect(() => { routeHandler.current = onRoute; }, [onRoute]);
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
      const floodEvent = !dam && !rain && !river && map.getLayer("flood-event-circle") ? map.queryRenderedFeatures([
        [event.point.x - 10, event.point.y - 10], [event.point.x + 10, event.point.y + 10],
      ], { layers: ["flood-event-circle"] }).find((feature) => typeof feature.properties?.id === "string") : undefined;
      const floodRisk = !dam && map.getLayer("flood-risk-circle") ? map.queryRenderedFeatures([
        [event.point.x - 6, event.point.y - 6], [event.point.x + 6, event.point.y + 6],
      ], { layers: ["flood-risk-circle"] }).find((feature) => typeof feature.properties?.id === "string") : undefined;
      const reservoirLayers = ["reservoir-point", "osm-minor-point"].filter((id) => map.getLayer(id));
      const reservoir = !dam && !rain && !river && reservoirLayers.length ? map.queryRenderedFeatures([
        [event.point.x - 7, event.point.y - 7], [event.point.x + 7, event.point.y + 7],
      ], { layers: reservoirLayers }).find((feature) => typeof feature.properties?.id === "string") : undefined;
      const cluster = !dam && !rain && !river && !reservoir && map.getLayer("reservoir-cluster") ? map.queryRenderedFeatures([
        [event.point.x - 10, event.point.y - 10], [event.point.x + 10, event.point.y + 10],
      ], { layers: ["reservoir-cluster"] })[0] : undefined;
      if (cluster && typeof cluster.properties?.cluster_id === "number" && cluster.geometry.type === "Point") {
        const [lon, lat] = cluster.geometry.coordinates;
        void (map.getSource("reservoirs") as GeoJSONSource).getClusterExpansionZoom(cluster.properties.cluster_id)
          .then((zoom) => map.easeTo({ center: [lon, lat], zoom }));
        return;
      }
      const route = !dam && !rain && !river && !reservoir && map.getLayer("all-routes") ? map.queryRenderedFeatures([
        [event.point.x - 6, event.point.y - 6], [event.point.x + 6, event.point.y + 6],
      ], { layers: ["all-routes"] }).filter((feature) => typeof feature.properties?.damId === "string")
        // Downstream reaches are shared by several routes; the dam nearest the tap is the one the user means.
        .sort((a, b) => Math.hypot(a.properties!.damLat - event.lngLat.lat, a.properties!.damLon - event.lngLat.lng)
          - Math.hypot(b.properties!.damLat - event.lngLat.lat, b.properties!.damLon - event.lngLat.lng))[0] : undefined;
      const favourite = !dam && !rain && !river && !reservoir && !route && map.getLayer("favourite-circle") ? map.queryRenderedFeatures([
        [event.point.x - 8, event.point.y - 8], [event.point.x + 8, event.point.y + 8],
      ], { layers: ["favourite-circle"] }).find((feature) =>
        typeof feature.properties?.lat === "number" && typeof feature.properties?.lon === "number") : undefined;
      const layers = ["quake-circle", "storm-cone", "storm-track", "storm-forecast"].filter((id) => map.getLayer(id));
      const features = layers.length ? map.queryRenderedFeatures(event.point, { layers }) : [];
      const quake = features.find((feature) => feature.layer?.id === "quake-circle" && typeof feature.properties?.id === "string");
      const storm = features.find((feature) => feature.layer?.id.startsWith("storm-") && typeof feature.properties?.id === "string");
      if (dam) select({ kind: "dam", id: dam.properties!.id as string });
      else if (rain) select({ kind: "rain", id: rain.properties!.id as string });
      else if (river) select({ kind: "river", id: river.properties!.id as string });
      else if (reservoir) select({ kind: "reservoir", id: reservoir.properties!.id as string });
      else if (floodEvent) select({ kind: "floodEvent", id: floodEvent.properties!.id as string });
      else if (floodRisk) select({ kind: "floodRisk", id: floodRisk.properties!.id as string });
      else if (route) {
        const damId = route.properties!.damId as string;
        select({ kind: "dam", id: damId });
        routeHandler.current?.(damId);
      }
      else if (favourite) select({ kind: "point", lat: favourite.properties!.lat as number, lon: favourite.properties!.lon as number });
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
