"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { lastRadarFrames } from "@/lib/radar/frames";
import type { RadarManifest } from "@/lib/radar/types";
import type { WindGrid } from "@/lib/wind/grid";
import type { Pm25Grid } from "@/lib/pm25/grid";
import type { Storm } from "@/lib/storms/normalize";
import type { Quake } from "@/lib/quakes/usgs";
import { buildTimeline, defaultIndex } from "@/lib/timeline/frames";

export function useMapData() {
  const [manifest, setManifest] = useState<RadarManifest | null>(null);
  const [initialIndex, setInitialIndex] = useState(0);
  const [wind, setWind] = useState<WindGrid | null>(null);
  const [pm25, setPm25] = useState<Pm25Grid | null>(null);
  const [pm25Status, setPm25Status] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const pm25Request = useRef<Promise<void> | null>(null);
  const pm25Controller = useRef<AbortController | null>(null);
  const [storms, setStorms] = useState<Storm[]>([]);
  const [quakes, setQuakes] = useState<Quake[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/radar", { signal: controller.signal })
      .then((response) => { if (!response.ok) throw new Error("radar unavailable"); return response.json() as Promise<RadarManifest>; })
      .then((data) => {
        const radarTimes = lastRadarFrames(data.provider === "rainviewer" ? data.frames : []).map((frame) => frame.time);
        setInitialIndex(defaultIndex(buildTimeline(radarTimes, [], new Date().toISOString())));
        setManifest(data);
      })
      .catch(() => { if (!controller.signal.aborted) setManifest(null); });
    fetch("/api/wind", { signal: controller.signal })
      .then((response) => { if (!response.ok) throw new Error("wind unavailable"); return response.json() as Promise<WindGrid>; })
      .then(setWind)
      .catch(() => { if (!controller.signal.aborted) setWind(null); });
    fetch("/api/storms", { signal: controller.signal })
      .then((response) => response.ok ? response.json() as Promise<{ storms?: Storm[] }> : { storms: [] })
      .then((data) => setStorms(data.storms ?? []))
      .catch(() => {});
    fetch("/api/quakes", { signal: controller.signal })
      .then((response) => response.ok ? response.json() as Promise<{ quakes?: Quake[] }> : { quakes: [] })
      .then((data) => setQuakes(data.quakes ?? []))
      .catch(() => {});
    return () => { controller.abort(); pm25Controller.current?.abort(); };
  }, []);

  const loadPm25 = useCallback((): Promise<void> => {
    if (pm25) return Promise.resolve();
    if (pm25Request.current) return pm25Request.current;
    const controller = new AbortController();
    pm25Controller.current = controller;
    setPm25Status("loading");
    const request = fetch("/api/pm25", { signal: controller.signal })
      .then((response) => { if (!response.ok) throw new Error("pm25 unavailable"); return response.json() as Promise<Pm25Grid>; })
      .then((data) => { setPm25(data); setPm25Status("ready"); })
      .catch((error: unknown) => { if (!controller.signal.aborted) setPm25Status("error"); throw error; })
      .finally(() => { pm25Request.current = null; pm25Controller.current = null; });
    pm25Request.current = request;
    return request;
  }, [pm25]);

  return { manifest, wind, pm25, pm25Status, loadPm25, storms, quakes, initialIndex };
}
