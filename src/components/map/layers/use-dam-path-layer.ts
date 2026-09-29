"use client";

import { useEffect } from "react";
import { LngLatBounds, type Map } from "maplibre-gl";
import { FLOW_DASH_STEPS, flowStep, flowWidth } from "@/lib/dams/flow";
import type { DamPath } from "@/lib/dams/paths";
import { useMapContext } from "../map-provider";
import { useStyleEffect } from "../use-style-effect";

const LAYERS = ["dam-path-casing", "dam-path", "dam-path-flow", "dam-path-arrows"] as const;

export function useDamPathLayer(map: Map | null, path: DamPath | null, releaseCms: number | null, isDesktop: boolean, reducedMotion: boolean) {
  const { theme } = useMapContext();
  const width = flowWidth(releaseCms);
  useStyleEffect(map, (live) => {
    if (!path) return;
    if (!live.getSource("dam-path")) live.addSource("dam-path", { type: "geojson", data: path });
    if (!live.getLayer("dam-path-casing")) live.addLayer({ id: "dam-path-casing", type: "line", source: "dam-path",
      paint: { "line-color": theme === "light" ? "#ffffff" : "#0f1720", "line-width": width + 4 } });
    if (!live.getLayer("dam-path")) live.addLayer({ id: "dam-path", type: "line", source: "dam-path",
      paint: { "line-color": "#2563eb", "line-width": width } });
    // Light dashes over the solid line; stepping the dash pattern makes them run downstream.
    if (!live.getLayer("dam-path-flow")) live.addLayer({ id: "dam-path-flow", type: "line", source: "dam-path",
      layout: { "line-cap": "butt" },
      paint: { "line-color": "#bfdbfe", "line-width": Math.max(2, width - 1.5), "line-dasharray": FLOW_DASH_STEPS[0] } });
    if (!live.getLayer("dam-path-arrows")) live.addLayer({ id: "dam-path-arrows", type: "symbol", source: "dam-path",
      layout: { "symbol-placement": "line", "symbol-spacing": 90, "text-field": "›", "text-font": ["Noto Sans Regular"],
        "text-size": 16, "text-keep-upright": false },
      paint: { "text-color": "#2563eb", "text-halo-color": "#ffffff", "text-halo-width": 1.5 } });
  }, (live) => {
    for (const id of LAYERS) if (live.getLayer(id)) live.removeLayer(id);
    if (live.getSource("dam-path")) live.removeSource("dam-path");
  }, [path, theme, width]);

  // Runs only while a route is shown, motion is allowed and the tab is visible.
  useEffect(() => {
    if (!map || !path || reducedMotion) return;
    let frame = 0;
    let shown = -1;
    const start = performance.now();
    const tick = (now: number) => {
      const step = flowStep(now - start);
      if (step !== shown && map.getLayer("dam-path-flow")) {
        map.setPaintProperty("dam-path-flow", "line-dasharray", FLOW_DASH_STEPS[step]);
        shown = step;
      }
      frame = requestAnimationFrame(tick);
    };
    const onVisibilityChange = () => {
      cancelAnimationFrame(frame);
      if (document.visibilityState === "visible") frame = requestAnimationFrame(tick);
    };
    onVisibilityChange();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => { cancelAnimationFrame(frame); document.removeEventListener("visibilitychange", onVisibilityChange); };
  }, [map, path, reducedMotion]);

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
