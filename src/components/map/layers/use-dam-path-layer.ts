"use client";

import { useEffect, useMemo } from "react";
import { LngLatBounds, type Map } from "maplibre-gl";
import { FLOW_DASH_STEPS, flowStep } from "@/lib/dams/flow";
import { flowWidth, flowColorRole, flowBucket } from "@/lib/map/flow-scale";
import type { DamPath } from "@/lib/dams/paths";
import { useMapContext } from "../map-provider";
import { useStyleEffect } from "../use-style-effect";

const LAYERS = ["dam-path-casing", "dam-path", "dam-path-flow", "dam-path-arrows"] as const;

export function useDamPathLayer(map: Map | null, path: DamPath | null, releaseCms: number | null, isDesktop: boolean, reducedMotion: boolean, lite: boolean) {
  const { theme } = useMapContext();
  const width = flowWidth(releaseCms);
  const role = flowColorRole(releaseCms);
  const bucket = flowBucket(releaseCms);
  useStyleEffect(map, (live) => {
    if (!path) return;
    const tokens = getComputedStyle(document.documentElement);
    const color = role === "water" ? "#bfdbfe" : tokens.getPropertyValue(`--${role}`).trim()
      || (role === "release" ? (theme === "light" ? "#b45309" : "#fbbf24") : (theme === "light" ? "#94a3b8" : "#64748b"));
    if (!live.getSource("dam-path")) live.addSource("dam-path", { type: "geojson", data: path });
    if (!live.getLayer("dam-path-casing")) live.addLayer({ id: "dam-path-casing", type: "line", source: "dam-path",
      paint: { "line-color": theme === "light" ? "#ffffff" : "#0f1720", "line-width": width + 4 } });
    if (!live.getLayer("dam-path")) live.addLayer({ id: "dam-path", type: "line", source: "dam-path",
      paint: { "line-color": color, "line-width": width, ...(role === "nodata" ? { "line-dasharray": [0.5, 2] } : {}) } });
    // Light dashes over the solid line; stepping the dash pattern makes them run downstream.
    if (!live.getLayer("dam-path-flow")) live.addLayer({ id: "dam-path-flow", type: "line", source: "dam-path",
      layout: { "line-cap": "butt" },
      paint: { "line-color": theme === "light" ? "#ffffff" : "#0f1720", "line-width": width,
        "line-opacity": bucket === "none" ? 0 : 0.55, "line-dasharray": FLOW_DASH_STEPS[0] } });
    if (!live.getLayer("dam-path-arrows")) live.addLayer({ id: "dam-path-arrows", type: "symbol", source: "dam-path",
      layout: { "symbol-placement": "line", "symbol-spacing": 90, "text-field": "›", "text-font": ["Noto Sans Regular"],
        "text-size": 16, "text-keep-upright": false },
      paint: { "text-color": color, "text-halo-color": "#ffffff", "text-halo-width": 1.5 } });
  }, (live) => {
    for (const id of LAYERS) if (live.getLayer(id)) live.removeLayer(id);
    if (live.getSource("dam-path")) live.removeSource("dam-path");
  }, [path, theme, width, role, bucket]);

  const targets = useMemo(() => path && bucket !== "none"
    ? [{ id: "dam-path-flow", speed: bucket === "slow" ? 0.25 : bucket === "mid" ? 0.5 : 1 }] : [], [path, bucket]);
  useFlowDashAnimation(map, targets, Boolean(path) && !reducedMotion && !lite, 60_000);

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

/** One frame loop for all speed layers; style reloads must receive the current pattern too. */
export function useFlowDashAnimation(map: Map | null, targets: { id: string; speed: number }[], enabled: boolean, duration = Infinity, yieldToFocus = false) {
  useEffect(() => {
    if (!map || !enabled || !targets.length) return;
    let frame = 0;
    const shown = new globalThis.Map<string, number>();
    const start = performance.now();
    const tick = (now: number) => {
      if (now - start >= duration) return;
      if (!yieldToFocus || !map.getLayer("dam-path-flow")) {
        for (const { id, speed } of targets) {
          const step = flowStep((now - start) * speed);
          if (step !== shown.get(id) && map.getLayer(id)) {
            map.setPaintProperty(id, "line-dasharray", FLOW_DASH_STEPS[step]);
            shown.set(id, step);
          }
        }
      }
      frame = requestAnimationFrame(tick);
    };
    const reset = () => { shown.clear(); };
    const onVisibilityChange = () => {
      cancelAnimationFrame(frame);
      if (document.visibilityState === "visible" && performance.now() - start < duration) frame = requestAnimationFrame(tick);
    };
    onVisibilityChange();
    map.on("style.load", reset);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      cancelAnimationFrame(frame);
      map.off("style.load", reset);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [map, targets, enabled, duration, yieldToFocus]);
}
