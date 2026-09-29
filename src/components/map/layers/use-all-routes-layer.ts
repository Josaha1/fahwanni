"use client";

import { useEffect, useMemo, useState } from "react";
import type { Map } from "maplibre-gl";
import type { DamsPayload } from "@/lib/dams/client";
import { flowWidth } from "@/lib/dams/flow";
import { loadDamPaths, type DamPath } from "@/lib/dams/paths";
import { useMapContext } from "../map-provider";
import { useStyleEffect } from "../use-style-effect";

const SOURCE = "all-routes";
export const ALL_ROUTES_LAYER = "all-routes";

/** Every dam's downstream route, faint, thicker where the dam releases more (water-mode overview). */
export function useAllRoutesLayer(map: Map | null, dams: DamsPayload | null, enabled: boolean) {
  const { theme } = useMapContext();
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
      return { ...path, properties: { damId: path.properties.damId, width: flowWidth(dam?.releaseCms ?? null) * 0.6,
        damLat: dam?.lat ?? path.geometry.coordinates[0][1], damLon: dam?.lon ?? path.geometry.coordinates[0][0] } };
    }) : [] };
  }, [dams, enabled, paths]);

  useStyleEffect(map, (live) => {
    if (!live.getSource(SOURCE) && data.features.length) live.addSource(SOURCE, { type: "geojson", data });
    if (!live.getSource(SOURCE)) return;
    // Below the focused route and every marker, so the overview never hides what the user tapped.
    const before = ["dam-path-casing", "river-circle", "rain-risk-circle", "dam-high", "dam-circle"].find((id) => live.getLayer(id));
    if (!live.getLayer(ALL_ROUTES_LAYER)) live.addLayer({ id: ALL_ROUTES_LAYER, type: "line", source: SOURCE,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": "#2563eb", "line-opacity": theme === "light" ? 0.35 : 0.45, "line-width": ["get", "width"] } }, before);
  }, (live) => {
    if (live.getLayer(ALL_ROUTES_LAYER)) live.removeLayer(ALL_ROUTES_LAYER);
    if (live.getSource(SOURCE)) live.removeSource(SOURCE);
  }, [data, theme]);
}
