"use client";

import { useEffect, useMemo } from "react";
import type { FilterSpecification, Map } from "maplibre-gl";
import type { DamsPayload } from "@/lib/dams/client";
import { damBandColor } from "@/lib/dams/bands";
import { useLite } from "@/hooks/use-lite";
import { RING_SIZE, ringSprite } from "@/lib/map/rings";
import { useT } from "@/i18n/client";
import { BASE } from "@/lib/map/base-style";
import { useMapContext } from "../map-provider";
import { useStyleEffect } from "../use-style-effect";

const SOURCE = "dams";
const LAYERS = ["dam-high", "dam-fallback", "dam-circle", "dam-label"] as const;
const RADIUS = ["interpolate", ["linear"], ["sqrt", ["max", 0, ["get", "capacity"]]], 10, 6, Math.sqrt(13462), 16] as
  ["interpolate", ["linear"], ["sqrt", ["max", 0, ["get", "capacity"]]], number, number, number, number];

type DamCollection = { type: "FeatureCollection"; features: {
  type: "Feature";
  properties: { id: string; band: number; color: string; sprite: string; capacity: number; high: 0 | 1; name: string };
  geometry: { type: "Point"; coordinates: [number, number] };
}[] };

function fallbackFilter(map: Map, data: DamCollection): FilterSpecification {
  return ["in", ["get", "sprite"], ["literal", [...new Set(data.features.map((feature) => feature.properties.sprite))]
    .filter((id) => !map.hasImage(id))]];
}

/** `visibleIds`: a water-mode filter chip; null shows every dam. */
export function useDamsLayer(map: Map | null, dams: DamsPayload | null, enabled: boolean, waterDay = 0, visibleIds: Set<string> | null = null) {
  const t = useT();
  const { theme } = useMapContext();
  const { reducedMotion, lite } = useLite();
  const data = useMemo<DamCollection>(() => ({
    type: "FeatureCollection",
    features: enabled ? (dams?.dams ?? []).filter((dam) => !visibleIds || visibleIds.has(dam.id)).map((dam) => ({
      type: "Feature", properties: {
        id: dam.id, band: dam.band, color: damBandColor(dam.band), sprite: ringSprite(dam.storagePct), capacity: dam.capacityMcm,
        high: dam.releaseCms !== null && dam.releaseCms >= 100 ? 1 : 0, name: t.locale === "en" ? dam.nameEn || dam.nameTh : dam.nameTh,
      }, geometry: { type: "Point", coordinates: [dam.lon, dam.lat] },
    })) : [],
  }), [dams, enabled, t.locale, visibleIds]);
  const pulse = !reducedMotion && !lite && waterDay === 0 && data.features.some((feature) => feature.properties.high);

  useEffect(() => {
    if (!map || !data.features.length) return;
    let active = true;
    const images = new globalThis.Map<string, HTMLImageElement | ImageBitmap>();
    const pending = new Set<string>();
    const failed = new Set<string>();
    const sprites = new Set(data.features.map((feature) => feature.properties.sprite));
    const add = (id: string, image: HTMLImageElement | ImageBitmap) => {
      if (!active) return;
      // Tile loading keeps isStyleLoaded false even when the style accepts images.
      if (!map.hasImage(id)) map.addImage(id, image, { pixelRatio: 2 });
      if (map.getLayer("dam-fallback")) map.setFilter("dam-fallback", fallbackFilter(map, data));
    };
    const loadSprite = (id: string) => {
      if (!sprites.has(id) || map.hasImage(id) || pending.has(id) || failed.has(id)) return;
      const cached = images.get(id);
      if (cached) { add(id, cached); return; }
      pending.add(id);
      void map.loadImage(`/map/rings/${id}.png`).then(({ data: image }) => {
        images.set(id, image);
        add(id, image);
      }).catch((error: unknown) => {
        failed.add(id);
        if (active) map.fire("error", { error: error instanceof Error ? error : new Error(String(error)) });
      }).finally(() => { pending.delete(id); });
    };
    const load = () => { for (const id of sprites) loadSprite(id); };
    const onMissing = (event: { id: string }) => loadSprite(event.id);
    map.on("styleimagemissing", onMissing);
    map.on("style.load", load);
    load();
    return () => { active = false; map.off("style.load", load); map.off("styleimagemissing", onMissing); };
  }, [map, data]);

  useStyleEffect(map, (live) => {
    if (!live.getSource(SOURCE) && data.features.length) live.addSource(SOURCE, { type: "geojson", data });
    if (!live.getSource(SOURCE)) return;
    if (pulse && !live.getLayer("dam-high")) live.addLayer({ id: "dam-high", type: "circle", source: SOURCE,
      filter: ["==", ["get", "high"], 1], paint: {
        "circle-radius": ["+", RADIUS, 5], "circle-color": "rgba(0, 0, 0, 0)",
        "circle-stroke-width": 2, "circle-stroke-color": "#fbbf24", "circle-stroke-opacity": 0.6,
      } });
    if (!live.getLayer("dam-fallback")) live.addLayer({ id: "dam-fallback", type: "circle", source: SOURCE,
      filter: fallbackFilter(live, data), paint: {
        "circle-radius": 4, "circle-color": ["get", "color"], "circle-opacity": waterDay > 0 ? 0.45 : 0.95,
      } });
    // Keep the id used by useProbe and neighbouring layers so taps still open the dam card.
    if (!live.getLayer("dam-circle")) live.addLayer({ id: "dam-circle", type: "symbol", source: SOURCE,
      layout: { "icon-image": ["get", "sprite"], "icon-size": ["/", ["*", RADIUS, 2], RING_SIZE],
        "icon-allow-overlap": true, "icon-ignore-placement": true },
      paint: { "icon-opacity": waterDay > 0 ? 0.45 : 0.95 } });
    if (!live.getLayer("dam-label")) live.addLayer({ id: "dam-label", type: "symbol", source: SOURCE, minzoom: 7,
      layout: { "text-field": ["get", "name"], "text-font": ["Noto Sans Regular"], "text-size": 11, "text-offset": [0, 1.6] },
      paint: { "text-color": BASE[theme].label, "text-halo-color": BASE[theme].halo, "text-halo-width": 1.5 } });
  }, (live) => {
    for (const id of LAYERS) if (live.getLayer(id)) live.removeLayer(id);
    if (live.getSource(SOURCE)) live.removeSource(SOURCE);
  }, [data, theme, waterDay, pulse]);

  useEffect(() => {
    if (!map || !pulse) return;
    let frame = 0;
    let last = -Infinity;
    const tick = (now: number) => {
      if (now - last >= 80 && map.getLayer("dam-high")) {
        // A focused route owns the screen's continuous motion while its flow layer is present.
        const phase = map.getLayer("dam-path-flow") ? 0 : (now % 1800) / 1800;
        map.setPaintProperty("dam-high", "circle-radius", ["+", RADIUS, 3 + phase * 7]);
        map.setPaintProperty("dam-high", "circle-stroke-opacity", map.getLayer("dam-path-flow") ? 0 : 0.6 * (1 - phase));
        last = now;
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
  }, [map, pulse]);
}
