"use client";

import { useEffect, useRef } from "react";
import type { Map } from "maplibre-gl";
import type { PrecipImage } from "@/lib/precip/render";
import { useStyleEffect } from "../use-style-effect";

export type ScalarImage = { url: string; coordinates: PrecipImage["coordinates"] };
const idFor = (prefix: string, index: number) => `${prefix}-${index}`;

export function useScalarLayer(map: Map | null, images: (ScalarImage | null)[], activeIndex: number, enabled: boolean, idPrefix: string, opacity: number) {
  const visibility = useRef({ activeIndex, enabled });
  useEffect(() => { visibility.current = { activeIndex, enabled }; }, [activeIndex, enabled]);

  useStyleEffect(map, (live) => {
    const firstSymbol = live.getStyle().layers.find((layer) => layer.type === "symbol")?.id;
    images.forEach((image, index) => {
      if (!image) return;
      const id = idFor(idPrefix, index);
      if (!live.getSource(id)) live.addSource(id, { type: "image", url: image.url, coordinates: image.coordinates });
      if (!live.getLayer(id)) live.addLayer({ id, type: "raster", source: id, paint: { "raster-opacity": 0, "raster-opacity-transition": { duration: 0 } } }, firstSymbol);
      const value = visibility.current.enabled && index === visibility.current.activeIndex ? opacity : 0;
      if (live.getPaintProperty(id, "raster-opacity") !== value) live.setPaintProperty(id, "raster-opacity", value);
    });
  }, (live) => {
    for (let index = 0; index < images.length; index++) {
      const id = idFor(idPrefix, index);
      if (live.getLayer(id)) live.removeLayer(id);
      if (live.getSource(id)) live.removeSource(id);
    }
  }, [images, idPrefix, opacity]);

  useEffect(() => {
    if (!map) return;
    images.forEach((image, index) => {
      const id = idFor(idPrefix, index);
      if (!image || !map.getLayer(id)) return;
      const value = enabled && index === activeIndex ? opacity : 0;
      if (map.getPaintProperty(id, "raster-opacity") !== value) map.setPaintProperty(id, "raster-opacity", value);
    });
  }, [map, images, activeIndex, enabled, idPrefix, opacity]);
}
