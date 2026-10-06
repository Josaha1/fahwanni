"use client";

import { useEffect, useMemo, useState } from "react";
import type { Map } from "maplibre-gl";
import type { DamsPayload } from "@/lib/dams/client";
import { FLOW_DASH_STEPS } from "@/lib/dams/flow";
import { flowWidth, flowColorRole, flowBucket } from "@/lib/map/flow-scale";
import { useLite } from "@/hooks/use-lite";
import { useFlowDashAnimation } from "./use-dam-path-layer";
import { loadDamPaths, type DamPath } from "@/lib/dams/paths";
import { useMapContext } from "../map-provider";
import { useStyleEffect } from "../use-style-effect";

const SOURCE = "all-routes";
export const ALL_ROUTES_LAYER = "all-routes";
const BUCKETS = [{ bucket: "slow", speed: 0.25 }, { bucket: "mid", speed: 0.5 }, { bucket: "fast", speed: 1 }] as const;
const LAYERS = [ALL_ROUTES_LAYER, "all-routes-nodata", ...BUCKETS.map(({ bucket }) => `all-routes-${bucket}`)];

/** Every dam's reported release along its downstream route (water-mode overview). */
export function useAllRoutesLayer(map: Map | null, dams: DamsPayload | null, enabled: boolean, waterDay = 0) {
  const { theme } = useMapContext();
  const { reducedMotion, lite } = useLite();
  const [paths, setPaths] = useState<DamPath[] | null>(null);

  useEffect(() => {
    if (!enabled || paths) return;
    let active = true;
    loadDamPaths().then(({ paths: loaded }) => { if (active) setPaths([...loaded.values()]); }).catch(() => {});
    return () => { active = false; };
  }, [enabled, paths]);

  const data = useMemo(() => {
    const byId = new globalThis.Map((dams?.dams ?? []).map((dam) => [dam.id, dam]));
    return { type: "FeatureCollection" as const, features: enabled && paths ? paths.map((path) => {
      const dam = byId.get(path.properties.damId);
      // The dam's position lets a tap on shared downstream reaches pick the nearest (most local) route.
      return { ...path, properties: { damId: path.properties.damId, width: flowWidth(dam?.releaseCms ?? null),
        releaseCms: dam?.releaseCms ?? null, role: flowColorRole(dam?.releaseCms ?? null), bucket: flowBucket(dam?.releaseCms ?? null),
        damLat: dam?.lat ?? path.geometry.coordinates[0][1], damLon: dam?.lon ?? path.geometry.coordinates[0][0] } };
    }) : [] };
  }, [dams, enabled, paths]);

  const targets = useMemo(() => BUCKETS.filter(({ bucket }) => data.features.some((feature) => feature.properties.bucket === bucket))
    .map(({ bucket, speed }) => ({ id: `all-routes-${bucket}`, speed })), [data]);
  const animate = enabled && !reducedMotion && !lite && waterDay === 0;

  useStyleEffect(map, (live) => {
    if (!live.getSource(SOURCE) && data.features.length) live.addSource(SOURCE, { type: "geojson", data });
    if (!live.getSource(SOURCE)) return;
    // Below the focused route and every marker, so the overview never hides what the user tapped.
    const before = ["dam-path-casing", "river-circle", "rain-risk-circle", "dam-high", "dam-circle"].find((id) => live.getLayer(id));
    // MapLibre paint cannot resolve CSS variables; read the active theme's colour roles.
    const tokens = getComputedStyle(document.documentElement);
    const release = tokens.getPropertyValue("--release").trim() || (theme === "light" ? "#b45309" : "#fbbf24");
    const nodata = tokens.getPropertyValue("--nodata").trim() || (theme === "light" ? "#94a3b8" : "#64748b");
    if (!live.getLayer(ALL_ROUTES_LAYER)) live.addLayer({ id: ALL_ROUTES_LAYER, type: "line", source: SOURCE,
      layout: { "line-cap": "round", "line-join": "round" },
      // Keep the complete route as the clickable layer, including unreported dotted routes.
      paint: { "line-color": ["case", ["==", ["get", "role"], "release"], release,
        ["==", ["get", "role"], "nodata"], nodata, "#bfdbfe"],
        "line-opacity": ["case", ["==", ["get", "role"], "nodata"], 0, waterDay > 0 ? 0.45 : 0.95],
        "line-width": ["get", "width"] } }, before);
    if (!live.getLayer("all-routes-nodata")) live.addLayer({ id: "all-routes-nodata", type: "line", source: SOURCE,
      filter: ["==", ["get", "role"], "nodata"], layout: { "line-cap": "round" },
      paint: { "line-color": nodata, "line-width": ["get", "width"], "line-dasharray": [0.5, 2],
        "line-opacity": waterDay > 0 ? 0.45 : 0.95 } }, before);
    for (const { bucket } of BUCKETS) {
      const id = `all-routes-${bucket}`;
      if (!live.getLayer(id)) live.addLayer({ id, type: "line", source: SOURCE,
        filter: ["==", ["get", "bucket"], bucket], layout: { "line-cap": "butt" },
        paint: { "line-color": theme === "light" ? "#ffffff" : "#0f1720", "line-width": ["get", "width"],
          "line-opacity": animate ? 0.55 : 0, "line-dasharray": FLOW_DASH_STEPS[0] } }, before);
    }
  }, (live) => {
    for (const id of [...LAYERS].reverse()) if (live.getLayer(id)) live.removeLayer(id);
    if (live.getSource(SOURCE)) live.removeSource(SOURCE);
  }, [data, theme, waterDay, animate]);

  useFlowDashAnimation(map, targets, animate, Infinity, true);
}
