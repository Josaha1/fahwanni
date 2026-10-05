"use client";

import { useRef } from "react";
import type { FillLayerSpecification, Map } from "maplibre-gl";
import type { BaseTheme } from "@/lib/map/base-style";
import { buildings3dLayer } from "@/lib/map/buildings-3d";
import { useStyleEffect } from "../use-style-effect";

export function useBuildings3dLayer(map: Map | null, enabled: boolean, theme: BaseTheme): void {
  const flatVisibility = useRef<NonNullable<FillLayerSpecification["layout"]>["visibility"] | null>(null);

  useStyleEffect(map, (live) => {
    const layers = live.getStyle()?.layers;
    if (!enabled || !layers) return;
    if (!live.getLayer("buildings-3d")) {
      const visibility = live.getLayer("building") ? live.getLayoutProperty("building", "visibility") ?? "visible" : null;
      const firstSymbol = layers.find((layer) => layer.type === "symbol")?.id;
      live.addLayer(buildings3dLayer(theme), firstSymbol);
      // A style reload supplies a new flat layer; restore that style's own visibility on exit.
      flatVisibility.current = visibility;
    }
    if (live.getLayer("building") && live.getLayoutProperty("building", "visibility") !== "none") {
      live.setLayoutProperty("building", "visibility", "none");
    }
  }, (live) => {
    if (!live.getLayer("buildings-3d")) return;
    live.removeLayer("buildings-3d");
    if (flatVisibility.current !== null && live.getLayer("building")) live.setLayoutProperty("building", "visibility", flatVisibility.current);
    flatVisibility.current = null;
  }, [enabled, theme]);
}
