"use client";

import { useEffect, useMemo, useState } from "react";
import type { Map } from "maplibre-gl";
import { accumulateRain, accumulationRgba } from "@/lib/rain-risk/accumulation";
import { renderScalarImage } from "@/lib/raster/render-scalar";
import { WIND_BBOX, WIND_NX, WIND_NY } from "@/lib/wind/grid";
import type { ForecastDay } from "@/lib/wind/days";
import { waterDate } from "../ui/water-day-stepper";
import { useStyleEffect } from "../use-style-effect";

const ID = "rain-accum";
const scalarGrid = { bbox: WIND_BBOX, nx: WIND_NX, ny: WIND_NY };

/** "none": the model has no cell at 90 mm or more in the next 72 h, so nothing is drawn. */
export type RainAccumStatus = "loading" | "shown" | "none" | "unavailable";

export function useRainAccumulation(map: Map | null, enabled: boolean, nowMs: number, waterDay: number): RainAccumStatus {
  const [days, setDays] = useState<Record<number, ForecastDay>>({});
  const [failed, setFailed] = useState(false);
  const lastDay = Math.min(6, waterDay + 3);
  useEffect(() => {
    if (!enabled || Array.from({ length: lastDay + 1 }, (_, day) => day).every((day) => days[day])) return;
    const controller = new AbortController();
    void Promise.all(Array.from({ length: lastDay + 1 }, async (_, day) => {
      if (days[day]) return days[day];
      const response = await fetch(`/api/wind?day=${day}`, { signal: controller.signal });
      if (!response.ok) throw new Error(`wind day ${day}: ${response.status}`);
      return response.json() as Promise<ForecastDay>;
    })).then((loaded) => { if (!controller.signal.aborted) { setDays((current) => Object.fromEntries([...Object.entries(current), ...loaded.map((item) => [item.day, item])])); setFailed(false); } })
      .catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [enabled, days, lastDay]);

  const fromMs = waterDay === 0 ? Math.floor(nowMs / 3_600_000) * 3_600_000 : Date.parse(`${waterDate(nowMs, waterDay)}T00:00:00+07:00`);
  const ready = Array.from({ length: lastDay + 1 }, (_, day) => days[day]).every(Boolean);
  const accumulated = useMemo(() => ready ? accumulateRain(Array.from({ length: lastDay + 1 }, (_, day) => days[day]), fromMs) : null, [days, ready, lastDay, fromMs]);
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
  if (failed || (ready && !accumulated)) return "unavailable";
  if (!ready) return "loading";
  return encoded ? "shown" : "none";
}
