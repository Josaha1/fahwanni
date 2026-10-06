"use client";

import type { Map } from "maplibre-gl";
import { useEffect, useMemo, useState } from "react";
import type { FeatureCollection, MultiPolygon, Polygon } from "geojson";
import type { FloodNowPayload } from "@/components/flood/home-data";
import { gibsTileUrl } from "@/lib/map/gibs";
import type { FloodReport } from "@/lib/map/gibs-replay";
import { isCloudy, provinceFillOpacity, provinceFloodRatio } from "@/lib/map/province-flood";
import { useMapContext } from "../map-provider";
import { useStyleEffect } from "../use-style-effect";

const ID = "sat-flood";
export const PROVINCE_FLOOD_LAYER = "province-flood-fill";
const SOURCE = "province-flood";
const HATCH = "province-cloud-hatch";
const LAYERS = [PROVINCE_FLOOD_LAYER, "province-flood-cloud", "province-flood-border"];
type ProvinceCollection = FeatureCollection<Polygon | MultiPolygon, { id: string }>;

export function useSatelliteFloodLayer(map: Map | null, enabled: boolean, report: FloodReport | null, snapshot: FloodNowPayload | null): void {
  const { theme } = useMapContext();
  const [geometry, setGeometry] = useState<ProvinceCollection | null>(null);
  const date = report?.date;
  const layer = report?.layer;
  useEffect(() => {
    if (!enabled || geometry) return;
    const controller = new AbortController();
    fetch("/data/th-provinces-lite.geojson", { signal: controller.signal })
      .then((response) => { if (!response.ok) throw new Error("province geometry unavailable"); return response.json() as Promise<ProvinceCollection>; })
      .then((data) => { if (!controller.signal.aborted) setGeometry(data); }).catch(() => {});
    return () => controller.abort();
  }, [enabled, geometry]);

  const data = useMemo(() => {
    // flood-now has no historical counts: never paint today's ratios on an older replay.
    if (!enabled || !geometry || !snapshot || snapshot.date !== date) return null;
    const max = Math.max(0, ...Object.values(snapshot.provinceCounts).map(provinceFloodRatio));
    return { ...geometry, features: geometry.features.map((feature) => {
      const counts = snapshot.provinceCounts[feature.properties.id];
      return { ...feature, properties: { ...feature.properties, opacity: provinceFillOpacity(counts, max), cloudy: isCloudy(counts) } };
    }) };
  }, [enabled, geometry, snapshot, date]);

  useStyleEffect(map, (live) => {
    if (!enabled || !date || !layer || !live.getStyle()?.layers) return;
    if (!live.getSource(ID)) live.addSource(ID, { type: "raster", tiles: [gibsTileUrl(layer, date, { z: "{z}", y: "{y}", x: "{x}" })], tileSize: 256, maxzoom: 9,
      attribution: "NASA LANCE/GIBS" });
    if (!live.getLayer(ID)) {
      const waterLayers = new Set(["all-routes", "dam-path-casing", "dam-path", "dam-path-flow", "river-circle", "rain-risk-circle", "rain-accum", "dam-high", "dam-circle"]);
      const before = live.getStyle().layers.find((item) => waterLayers.has(item.id))?.id
        ?? live.getStyle().layers.find((item) => item.type === "symbol")?.id;
      live.addLayer({ id: ID, type: "raster", source: ID, minzoom: 8, paint: { "raster-opacity": 0.85, "raster-fade-duration": 0 } }, before);
    }
  }, (live) => {
    if (live.getLayer(ID)) live.removeLayer(ID);
    if (live.getSource(ID)) live.removeSource(ID);
  }, [enabled, date, layer]);

  useStyleEffect(map, (live) => {
    if (!data || !live.getStyle()?.layers) return;
    const tokens = getComputedStyle(document.documentElement);
    const water = tokens.getPropertyValue("--water").trim() || "#22d3ee";
    const grey = tokens.getPropertyValue("--nodata").trim() || "#64748b";
    if (!live.hasImage(HATCH)) {
      // A seamless 8px diagonal tile, generated at runtime without a bitmap asset.
      const pixels = new Uint8Array(8 * 8 * 4);
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 8;
      const context = canvas.getContext("2d");
      if (!context) return;
      context.fillStyle = grey;
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if ((x + y) % 8 < 2) context.fillRect(x, y, 1, 1);
      pixels.set(context.getImageData(0, 0, 8, 8).data);
      live.addImage(HATCH, { width: 8, height: 8, data: pixels });
    }
    if (!live.getSource(SOURCE)) live.addSource(SOURCE, { type: "geojson", data,
      attribution: "geoBoundaries / © OpenStreetMap contributors (ODbL)", tolerance: 0 });
    const waterLayers = new Set(["all-routes", "dam-path-casing", "dam-path", "dam-path-flow", "river-circle", "rain-risk-circle", "dam-high", "dam-fallback", "dam-circle", "reservoir-point", "flood-event-halo", "flood-risk-circle"]);
    const before = live.getStyle().layers.find((item) => waterLayers.has(item.id))?.id
      ?? live.getStyle().layers.find((item) => item.type === "symbol")?.id;
    if (!live.getLayer(PROVINCE_FLOOD_LAYER)) live.addLayer({ id: PROVINCE_FLOOD_LAYER, type: "fill", source: SOURCE,
      paint: { "fill-color": water, "fill-opacity": ["get", "opacity"] } }, live.getLayer(ID) ? ID : before);
    if (!live.getLayer("province-flood-cloud")) live.addLayer({ id: "province-flood-cloud", type: "fill", source: SOURCE,
      filter: ["==", ["get", "cloudy"], true], paint: { "fill-pattern": HATCH, "fill-opacity": 0.65 } }, before);
    if (!live.getLayer("province-flood-border")) live.addLayer({ id: "province-flood-border", type: "line", source: SOURCE,
      paint: { "line-color": grey, "line-width": 0.5, "line-opacity": 0.6 } }, before);
  }, (live) => {
    for (const id of [...LAYERS].reverse()) if (live.getLayer(id)) live.removeLayer(id);
    if (live.getSource(SOURCE)) live.removeSource(SOURCE);
    if (live.hasImage(HATCH)) live.removeImage(HATCH);
  }, [data, theme]);
}
