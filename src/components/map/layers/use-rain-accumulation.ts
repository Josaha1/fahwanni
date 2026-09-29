"use client";

import { useEffect, useMemo, useState } from "react";
import type { Map } from "maplibre-gl";
import { accumulateRain, accumulationRgba } from "@/lib/rain-risk/accumulation";
import { renderScalarImage } from "@/lib/raster/render-scalar";
import { WIND_BBOX, WIND_NX, WIND_NY } from "@/lib/wind/grid";
import type { ForecastDay } from "@/lib/wind/days";
import { useStyleEffect } from "../use-style-effect";

const ID = "rain-accum";
const scalarGrid = { bbox: WIND_BBOX, nx: WIND_NX, ny: WIND_NY };

/** "none": the model has no cell at 90 mm or more in the next 72 h, so nothing is drawn. */
export type RainAccumStatus = "loading" | "shown" | "none" | "unavailable";

export function useRainAccumulation(map: Map | null, enabled: boolean, nowMs: number): RainAccumStatus {
  const [days, setDays] = useState<ForecastDay[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!enabled || days) return;
    const controller = new AbortController();
    void Promise.all(Array.from({ length: 4 }, async (_, day) => {
      const response = await fetch(`/api/wind?day=${day}`, { signal: controller.signal });
      if (!response.ok) throw new Error(`wind day ${day}: ${response.status}`);
      return response.json() as Promise<ForecastDay>;
    })).then((loaded) => { if (!controller.signal.aborted) setDays(loaded); })
      .catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [enabled, days]);

  const hour = Math.floor(nowMs / 3_600_000);
  const accumulated = useMemo(() => days ? accumulateRain(days, hour * 3_600_000) : null, [days, hour]);
  const encoded = useMemo(() => {
    const result = accumulated;
    if (!result || !result.values.some((mm) => mm >= 90)) return null;
    const image = renderScalarImage(scalarGrid, (at) => accumulationRgba(at(result.values)));
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext("2d");
    if (!context) return null;
    const pixels = context.createImageData(image.width, image.height);
    pixels.data.set(image.data);
    context.putImageData(pixels, 0, 0);
    return { url: canvas.toDataURL("image/png"), coordinates: image.coordinates };
  }, [accumulated]);

  useStyleEffect(map, (live) => {
    if (!enabled || !encoded || !live.getStyle()?.layers) return;
    if (!live.getSource(ID)) live.addSource(ID, { type: "image", ...encoded });
    if (!live.getLayer(ID)) {
      const before = ["rain-risk-circle", "dam-circle"].find((id) => live.getLayer(id))
        ?? live.getStyle().layers.find((layer) => layer.type === "symbol")?.id;
      live.addLayer({ id: ID, type: "raster", source: ID, paint: { "raster-fade-duration": 0 } }, before);
    }
  }, (live) => {
    if (live.getLayer(ID)) live.removeLayer(ID);
    if (live.getSource(ID)) live.removeSource(ID);
  }, [enabled, encoded]);
  if (failed || (days && !accumulated)) return "unavailable";
  if (!days) return "loading";
  return encoded ? "shown" : "none";
}
