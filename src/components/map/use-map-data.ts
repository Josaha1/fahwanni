"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { lastRadarFrames } from "@/lib/radar/frames";
import type { RadarManifest } from "@/lib/radar/types";
import type { WindGrid } from "@/lib/wind/grid";
import type { Pm25Grid } from "@/lib/pm25/grid";
import type { Storm } from "@/lib/storms/normalize";
import type { Quake } from "@/lib/quakes/usgs";
import type { DamsPayload } from "@/lib/dams/client";
import { buildTimeline, defaultIndex } from "@/lib/timeline/frames";
import { REFRESH, shouldRefresh } from "@/lib/map/refresh";

type DataKey = "radar" | "wind" | "storms" | "quakes" | "pm25" | "dams";
type FetchTimes = Record<DataKey, number | null>;

export function useMapData() {
  const [manifest, setManifest] = useState<RadarManifest | null>(null);
  const [radarFetchedAt, setRadarFetchedAt] = useState<number | null>(null);
  const [initialIndex, setInitialIndex] = useState(0);
  const [wind, setWind] = useState<WindGrid | null>(null);
  const [windSettled, setWindSettled] = useState(false);
  const [pm25, setPm25] = useState<Pm25Grid | null>(null);
  const [pm25Status, setPm25Status] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const pm25Request = useRef<Promise<void> | null>(null);
  const pm25Controller = useRef<AbortController | null>(null);
  const pm25Loaded = useRef(false);
  const [dams, setDams] = useState<DamsPayload | null>(null);
  const [damsStatus, setDamsStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const damsRequest = useRef<Promise<void> | null>(null);
  const damsController = useRef<AbortController | null>(null);
  const damsLoaded = useRef(false);
  const lastFetched = useRef<FetchTimes>({ radar: null, wind: null, storms: null, quakes: null, pm25: null, dams: null });
  const [storms, setStorms] = useState<Storm[]>([]);
  const [quakes, setQuakes] = useState<Quake[]>([]);

  const loadPm25 = useCallback((refresh = false): Promise<void> => {
    if (!refresh && pm25Loaded.current) return Promise.resolve();
    if (!refresh && pm25Request.current) return pm25Request.current;
    pm25Controller.current?.abort();
    const controller = new AbortController();
    pm25Controller.current = controller;
    if (!pm25Loaded.current) setPm25Status("loading");
    const request = fetch("/api/pm25", { signal: controller.signal })
      .then((response) => { if (!response.ok) throw new Error("pm25 unavailable"); return response.json() as Promise<Pm25Grid>; })
      .then((data) => {
        if (controller.signal.aborted) return;
        lastFetched.current.pm25 = Date.now();
        pm25Loaded.current = true;
        setPm25(data);
        setPm25Status("ready");
      })
      .catch((error: unknown) => { if (!controller.signal.aborted && !pm25Loaded.current) setPm25Status("error"); throw error; })
      .finally(() => {
        if (pm25Controller.current === controller) {
          pm25Request.current = null;
          pm25Controller.current = null;
        }
      });
    pm25Request.current = request;
    return request;
  }, []);

  const loadDams = useCallback((refresh = false): Promise<void> => {
    if (!refresh && damsLoaded.current) return Promise.resolve();
    if (!refresh && damsRequest.current) return damsRequest.current;
    damsController.current?.abort();
    const controller = new AbortController();
    damsController.current = controller;
    if (!damsLoaded.current) setDamsStatus("loading");
    const request = fetch("/api/dams", { signal: controller.signal })
      .then((response) => { if (!response.ok) throw new Error("dams unavailable"); return response.json() as Promise<DamsPayload>; })
      .then((data) => {
        if (controller.signal.aborted) return;
        lastFetched.current.dams = Date.now();
        damsLoaded.current = true;
        setDams(data);
        setDamsStatus("ready");
      })
      .catch((error: unknown) => { if (!controller.signal.aborted && !damsLoaded.current) setDamsStatus("error"); throw error; })
      .finally(() => {
        if (damsController.current === controller) {
          damsRequest.current = null;
          damsController.current = null;
        }
      });
    damsRequest.current = request;
    return request;
  }, []);

  useEffect(() => {
    const controllers: Partial<Record<Exclude<DataKey, "pm25" | "dams">, AbortController>> = {};
    const replaceController = (key: Exclude<DataKey, "pm25" | "dams">) => {
      controllers[key]?.abort();
      const controller = new AbortController();
      controllers[key] = controller;
      return controller;
    };
    const loadRadar = () => {
      const controller = replaceController("radar");
      fetch("/api/radar", { signal: controller.signal })
        .then((response) => { if (!response.ok) throw new Error("radar unavailable"); return response.json() as Promise<RadarManifest>; })
        .then((data) => {
          if (controller.signal.aborted) return;
          const fetchedAt = Date.now();
          if (lastFetched.current.radar === null) {
            const radarTimes = lastRadarFrames(data.provider === "rainviewer" ? data.frames : []).map((frame) => frame.time);
            setInitialIndex(defaultIndex(buildTimeline(radarTimes, [], new Date(fetchedAt).toISOString())));
          }
          lastFetched.current.radar = fetchedAt;
          setRadarFetchedAt(fetchedAt);
          setManifest((previous) => previous && previous.provider === data.provider && previous.frames.at(-1)?.time === data.frames.at(-1)?.time ? previous : data);
        })
        .catch(() => { if (!controller.signal.aborted && lastFetched.current.radar === null) setManifest(null); });
    };
    const loadWind = () => {
      const controller = replaceController("wind");
      fetch("/api/wind", { signal: controller.signal })
        .then((response) => { if (!response.ok) throw new Error("wind unavailable"); return response.json() as Promise<WindGrid>; })
        .then((data) => {
          if (controller.signal.aborted) return;
          lastFetched.current.wind = Date.now();
          setWind(data);
        })
        .catch(() => { if (!controller.signal.aborted && lastFetched.current.wind === null) setWind(null); })
        .finally(() => { if (!controller.signal.aborted) setWindSettled(true); });
    };
    const loadStorms = () => {
      const controller = replaceController("storms");
      fetch("/api/storms", { signal: controller.signal })
        .then((response) => { if (!response.ok) throw new Error("storms unavailable"); return response.json() as Promise<{ storms?: Storm[] }>; })
        .then((data) => {
          if (controller.signal.aborted) return;
          lastFetched.current.storms = Date.now();
          setStorms(data.storms ?? []);
        })
        .catch(() => {});
    };
    const loadQuakes = () => {
      const controller = replaceController("quakes");
      fetch("/api/quakes", { signal: controller.signal })
        .then((response) => { if (!response.ok) throw new Error("quakes unavailable"); return response.json() as Promise<{ quakes?: Quake[] }>; })
        .then((data) => {
          if (controller.signal.aborted) return;
          lastFetched.current.quakes = Date.now();
          setQuakes(data.quakes ?? []);
        })
        .catch(() => {});
    };
    const refreshOnReturn = () => {
      const now = Date.now();
      if (shouldRefresh(lastFetched.current.radar, now, REFRESH.radar)) loadRadar();
      if (lastFetched.current.wind !== null && shouldRefresh(lastFetched.current.wind, now, REFRESH.slow)) loadWind();
      if (lastFetched.current.storms !== null && shouldRefresh(lastFetched.current.storms, now, REFRESH.slow)) loadStorms();
      if (lastFetched.current.quakes !== null && shouldRefresh(lastFetched.current.quakes, now, REFRESH.slow)) loadQuakes();
      if (lastFetched.current.pm25 !== null && shouldRefresh(lastFetched.current.pm25, now, REFRESH.slow)) loadPm25(true).catch(() => {});
      if (lastFetched.current.dams !== null && shouldRefresh(lastFetched.current.dams, now, REFRESH.slow)) loadDams(true).catch(() => {});
    };
    const onVisibilityChange = () => { if (document.visibilityState === "visible") refreshOnReturn(); };
    loadRadar();
    loadWind();
    loadStorms();
    loadQuakes();
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") loadRadar(); }, REFRESH.radar);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("online", refreshOnReturn);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("online", refreshOnReturn);
      Object.values(controllers).forEach((controller) => controller.abort());
      pm25Controller.current?.abort();
      damsController.current?.abort();
    };
  }, [loadPm25, loadDams]);

  return { manifest, radarFetchedAt, wind, windSettled, pm25, pm25Status, loadPm25, dams, damsStatus, loadDams, storms, quakes, initialIndex };
}
