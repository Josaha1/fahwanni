"use client";

import { useEffect, useRef } from "react";
import type { ImageSource, Map } from "maplibre-gl";
import { renderPm25At, renderRainAt, renderTempAt } from "@/lib/raster/render-at";
import type { ScalarImage } from "@/lib/raster/render-scalar";
import { rainModeAt } from "@/lib/precip/render";
import type { HourlySeries } from "@/lib/timeline/store";
import { useStyleEffect } from "../use-style-effect";

type Kind = "rain" | "temp" | "pm25";
type Grid = { bbox: readonly [number, number, number, number]; nx: number; ny: number };
type Encoded = { url: string; coordinates: ScalarImage["coordinates"] };
type Request = { series: HourlySeries; minute: number; kind: Kind; grid: Grid; nowMs: number; size: number; leadBucket: string };

export function useTimeImageLayer(map: Map | null, { id, enabled, series, timeMs, nowMs, kind, grid, beforeSymbol, opacity, size }: {
  id: "model-rain" | "temp" | "pm25"; enabled: boolean; series: HourlySeries | null; timeMs: number | null;
  nowMs: number; kind: Kind; grid: Grid; beforeSymbol: true; opacity: number; size: number;
}) {
  const latest = useRef<Encoded | null>(null);
  const visible = useRef(false);
  const sourceRef = useRef<ImageSource | null>(null);
  const sourceUrl = useRef<string | null>(null);
  const updatingUrl = useRef<string | null>(null);
  const onData = useRef<(() => void) | null>(null);
  const request = useRef<Request | null>(null);
  const rendered = useRef<Request | null>(null);
  const paintOpacity = useRef(opacity);
  const frame = useRef<number | null>(null);
  const encoding = useRef(false);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const pixels = useRef<ImageData | null>(null);
  const active = useRef(true);

  useEffect(() => { paintOpacity.current = opacity; }, [opacity]);

  const same = (a: Request | null, b: Request | null) => a?.series === b?.series && a?.minute === b?.minute && a?.kind === b?.kind && a?.size === b?.size && a?.leadBucket === b?.leadBucket;
  const detach = () => {
    if (sourceRef.current && onData.current) sourceRef.current.off("data", onData.current);
    onData.current = null;
    sourceRef.current = null;
    updatingUrl.current = null;
  };
  const send = (live: Map, source: ImageSource, image: Encoded) => {
    const previous = sourceUrl.current;
    updatingUrl.current = image.url;
    const loaded = () => {
      if (sourceRef.current !== source) return;
      onData.current = null;
      sourceUrl.current = image.url;
      updatingUrl.current = null;
      if (previous && previous !== image.url) URL.revokeObjectURL(previous);
      const next = latest.current;
      if (next && next.url !== image.url && live.getSource(id) === source) send(live, source, next);
    };
    onData.current = loaded;
    source.once("data", loaded);
    try { source.updateImage(image); } catch (error) {
      source.off("data", loaded);
      onData.current = null;
      updatingUrl.current = null;
      throw error;
    }
  };
  const apply = (live: Map) => {
    const image = latest.current;
    const layers = live.getStyle()?.layers;
    if (!image || !layers) return;
    if (!live.getSource(id)) live.addSource(id, { type: "image", url: image.url, coordinates: image.coordinates });
    const source = live.getSource(id) as ImageSource;
    if (sourceRef.current !== source) {
      const previous = sourceUrl.current;
      const updating = updatingUrl.current;
      detach();
      sourceRef.current = source;
      sourceUrl.current = image.url;
      if (previous && previous !== image.url) URL.revokeObjectURL(previous);
      if (updating && updating !== image.url && updating !== previous) URL.revokeObjectURL(updating);
    }
    if (!live.getLayer(id)) {
      const firstSymbol = beforeSymbol ? layers.find((layer) => layer.type === "symbol")?.id : undefined;
      live.addLayer({ id, type: "raster", source: id, paint: { "raster-opacity": paintOpacity.current, "raster-fade-duration": 0 }, layout: { visibility: visible.current ? "visible" : "none" } }, firstSymbol);
    }
    if (live.getPaintProperty(id, "raster-opacity") !== paintOpacity.current) live.setPaintProperty(id, "raster-opacity", paintOpacity.current);
    if (!updatingUrl.current && sourceUrl.current !== image.url) send(live, source, image);
  };

  useStyleEffect(map, apply, (live) => {
    if (live.getLayer(id)) live.removeLayer(id);
    if (live.getSource(id)) live.removeSource(id);
    const previous = sourceUrl.current;
    const updating = updatingUrl.current;
    detach();
    sourceUrl.current = null;
    if (previous && previous !== latest.current?.url) URL.revokeObjectURL(previous);
    if (updating && updating !== latest.current?.url && updating !== previous) URL.revokeObjectURL(updating);
  }, [id, beforeSymbol]);

  useEffect(() => {
    if (map?.getLayer(id) && map.getPaintProperty(id, "raster-opacity") !== opacity) map.setPaintProperty(id, "raster-opacity", opacity);
  }, [map, id, opacity]);

  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      if (latest.current) URL.revokeObjectURL(latest.current.url);
      if (sourceUrl.current && sourceUrl.current !== latest.current?.url) URL.revokeObjectURL(sourceUrl.current);
      if (updatingUrl.current && updatingUrl.current !== latest.current?.url && updatingUrl.current !== sourceUrl.current) URL.revokeObjectURL(updatingUrl.current);
      detach();
      latest.current = null;
    };
  }, []);

  useEffect(() => {
    visible.current = enabled && series !== null && timeMs !== null;
    if (map?.getLayer(id)) map.setLayoutProperty(id, "visibility", visible.current ? "visible" : "none");
  }, [map, id, enabled, series, timeMs]);

  useEffect(() => {
    const minute = timeMs === null ? null : Math.round(timeMs / 60_000);
    const leadMs = minute === null ? 0 : minute * 60_000 - nowMs;
    const mode = rainModeAt(leadMs);
    const leadBucket = kind === "rain" ? `${mode}:${mode === "blend" ? Math.floor(leadMs / 60_000) : ""}` : "";
    request.current = map && enabled && series && minute !== null
      ? { series, minute, kind, grid, nowMs, size, leadBucket } : null;
    if (!request.current) {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = null;
      return;
    }
    const schedule = () => {
      if (frame.current !== null || encoding.current || !request.current) return;
      frame.current = requestAnimationFrame(() => {
        frame.current = null;
        const next = request.current;
        if (!next || !active.current) return;
        if (same(rendered.current, next) && latest.current) return;
        if (!canvas.current || canvas.current.width !== next.size) {
          const fresh = document.createElement("canvas");
          fresh.width = next.size; fresh.height = next.size;
          canvas.current = fresh;
          pixels.current = null;
        }
        const surface = canvas.current;
        const context = surface.getContext("2d");
        if (!context) return;
        const data = pixels.current ?? context.createImageData(next.size, next.size);
        pixels.current = data;
        const t = next.minute * 60_000;
        const image = next.kind === "rain" ? renderRainAt(next.series, t, next.grid, next.nowMs, next.size, next.size, data.data)
          : next.kind === "temp" ? renderTempAt(next.series, t, next.grid, next.size, next.size, data.data)
            : renderPm25At(next.series, t, next.grid, next.size, next.size, data.data);
        if (!image) return;
        context.putImageData(data, 0, 0);
        encoding.current = true;
        surface.toBlob((blob) => {
          encoding.current = false;
          if (!active.current) return;
          if (blob && same(request.current, next)) {
            const encoded = { url: URL.createObjectURL(blob), coordinates: image.coordinates };
            const previous = latest.current;
            latest.current = encoded;
            rendered.current = next;
            if (previous && previous.url !== sourceUrl.current && previous.url !== updatingUrl.current) URL.revokeObjectURL(previous.url);
            if (map) {
              try { apply(map); } catch { /* The style may be loading; useStyleEffect retries on style.load. */ }
            }
          }
          if (request.current && !same(request.current, next)) schedule();
        }, "image/png");
      });
    };
    schedule();
    // The style callback reads refs and stable layer options; request changes drive this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, enabled, series, timeMs, nowMs, kind, grid, size]);
}
