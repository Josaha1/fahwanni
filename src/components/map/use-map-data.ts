"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RadarManifest } from "@/lib/radar/types";
import type { WindGrid } from "@/lib/wind/grid";
import type { Storm } from "@/lib/storms/normalize";
import type { Quake } from "@/lib/quakes/usgs";
import type { DamsPayload } from "@/lib/dams/client";
import type { DamTrend } from "@/lib/dams/trend";
import type { DamHistory } from "@/lib/dams/history";
import type { RainRisk } from "@/lib/rain-risk/tmd";
import type { TmdWarnings } from "@/lib/tmd";
import type { RiversPayload } from "@/components/water/river-details";
import { REFRESH, shouldRefresh } from "@/lib/map/refresh";

type DataKey = "radar" | "wind" | "storms" | "quakes" | "dams" | "rainRisk" | "rivers" | "tmdWarnings";
type FetchTimes = Record<DataKey, number | null>;

export function useMapData(modelEnabled = true) {
  const [manifest, setManifest] = useState<RadarManifest | null>(null);
  const [radarFetchedAt, setRadarFetchedAt] = useState<number | null>(null);
  const [wind, setWind] = useState<WindGrid | null>(null);
  const [windSettled, setWindSettled] = useState(false);
  const [dams, setDams] = useState<DamsPayload | null>(null);
  const [damsTrend, setDamsTrend] = useState<DamTrend | null>(null);
  const damsTrendRequest = useRef<Promise<void> | null>(null);
  const damsTrendLoaded = useRef(false);
  const [damsHistory, setDamsHistory] = useState<DamHistory | null>(null);
  const damsHistoryRequest = useRef<Promise<void> | null>(null);
  const damsHistoryLoaded = useRef(false);
  const [rainRisk, setRainRisk] = useState<RainRisk | null>(null);
  const [rivers, setRivers] = useState<RiversPayload | null>(null);
  const [riversStatus, setRiversStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const riversRequest = useRef<Promise<void> | null>(null);
  const riversController = useRef<AbortController | null>(null);
  const riversLoaded = useRef(false);
  const [tmdWarnings, setTmdWarnings] = useState<TmdWarnings | null>(null);
  const [tmdWarningsStatus, setTmdWarningsStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const tmdWarningsRequest = useRef<Promise<void> | null>(null);
  const tmdWarningsController = useRef<AbortController | null>(null);
  const tmdWarningsLoaded = useRef(false);
  const [rainRiskStatus, setRainRiskStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const rainRiskRequest = useRef<Promise<void> | null>(null);
  const rainRiskController = useRef<AbortController | null>(null);
  const rainRiskLoaded = useRef(false);
  const [damsStatus, setDamsStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const damsRequest = useRef<Promise<void> | null>(null);
  const damsController = useRef<AbortController | null>(null);
  const damsLoaded = useRef(false);
  const lastFetched = useRef<FetchTimes>({ radar: null, wind: null, storms: null, quakes: null, dams: null, rainRisk: null, rivers: null, tmdWarnings: null });
  const [storms, setStorms] = useState<Storm[]>([]);
  const [quakes, setQuakes] = useState<Quake[]>([]);

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

  const loadDamsTrend = useCallback((): Promise<void> => {
    if (damsTrendLoaded.current) return Promise.resolve();
    if (damsTrendRequest.current) return damsTrendRequest.current;
    const request = fetch("/api/dams-trend")
      .then((response) => { if (!response.ok) throw new Error("dam trend unavailable"); return response.json() as Promise<DamTrend>; })
      .then((data) => { damsTrendLoaded.current = true; setDamsTrend(data); })
      .finally(() => { damsTrendRequest.current = null; });
    damsTrendRequest.current = request;
    return request;
  }, []);

  const loadDamsHistory = useCallback((): Promise<void> => {
    if (damsHistoryLoaded.current) return Promise.resolve();
    if (damsHistoryRequest.current) return damsHistoryRequest.current;
    const request = fetch("/api/dams-history")
      .then((response) => { if (!response.ok) throw new Error("dam history unavailable"); return response.json() as Promise<DamHistory>; })
      .then((data) => { damsHistoryLoaded.current = true; setDamsHistory(data); })
      .finally(() => { damsHistoryRequest.current = null; });
    damsHistoryRequest.current = request;
    return request;
  }, []);

  const loadRainRisk = useCallback((refresh = false): Promise<void> => {
    if (!refresh && rainRiskLoaded.current) return Promise.resolve();
    if (!refresh && rainRiskRequest.current) return rainRiskRequest.current;
    rainRiskController.current?.abort();
    const controller = new AbortController();
    rainRiskController.current = controller;
    if (!rainRiskLoaded.current) setRainRiskStatus("loading");
    const request = fetch("/api/rain-risk", { signal: controller.signal })
      .then((response) => { if (!response.ok) throw new Error("rain risk unavailable"); return response.json() as Promise<RainRisk>; })
      .then((data) => {
        if (controller.signal.aborted) return;
        lastFetched.current.rainRisk = Date.now();
        rainRiskLoaded.current = true;
        setRainRisk(data);
        setRainRiskStatus("ready");
      })
      .catch((error: unknown) => { if (!controller.signal.aborted && !rainRiskLoaded.current) setRainRiskStatus("error"); throw error; })
      .finally(() => {
        if (rainRiskController.current === controller) {
          rainRiskRequest.current = null;
          rainRiskController.current = null;
        }
      });
    rainRiskRequest.current = request;
    return request;
  }, []);

  const loadRivers = useCallback((refresh = false): Promise<void> => {
    if (!refresh && riversLoaded.current) return Promise.resolve();
    if (!refresh && riversRequest.current) return riversRequest.current;
    riversController.current?.abort();
    const controller = new AbortController();
    riversController.current = controller;
    if (!riversLoaded.current) setRiversStatus("loading");
    const request = fetch("/api/rivers", { signal: controller.signal })
      .then((response) => { if (!response.ok) throw new Error("rivers unavailable"); return response.json() as Promise<RiversPayload>; })
      .then((data) => {
        if (controller.signal.aborted) return;
        if (!Array.isArray(data.points)) throw new Error("invalid rivers response");
        lastFetched.current.rivers = Date.now();
        riversLoaded.current = true;
        setRivers(data);
        setRiversStatus("ready");
      })
      .catch((error: unknown) => { if (!controller.signal.aborted && !riversLoaded.current) setRiversStatus("error"); throw error; })
      .finally(() => {
        if (riversController.current === controller) {
          riversRequest.current = null;
          riversController.current = null;
        }
      });
    riversRequest.current = request;
    return request;
  }, []);

  const loadTmdWarnings = useCallback((refresh = false): Promise<void> => {
    if (!refresh && tmdWarningsLoaded.current) return Promise.resolve();
    if (!refresh && tmdWarningsRequest.current) return tmdWarningsRequest.current;
    tmdWarningsController.current?.abort();
    const controller = new AbortController();
    tmdWarningsController.current = controller;
    if (!tmdWarningsLoaded.current) setTmdWarningsStatus("loading");
    const request = fetch("/api/tmd-warnings", { signal: controller.signal })
      .then((response) => { if (!response.ok) throw new Error("TMD warnings unavailable"); return response.json() as Promise<TmdWarnings>; })
      .then((data) => {
        if (controller.signal.aborted) return;
        lastFetched.current.tmdWarnings = Date.now();
        tmdWarningsLoaded.current = true;
        setTmdWarnings(data);
        setTmdWarningsStatus("ready");
      })
      .catch((error: unknown) => { if (!controller.signal.aborted && !tmdWarningsLoaded.current) setTmdWarningsStatus("error"); throw error; })
      .finally(() => {
        if (tmdWarningsController.current === controller) {
          tmdWarningsRequest.current = null;
          tmdWarningsController.current = null;
        }
      });
    tmdWarningsRequest.current = request;
    return request;
  }, []);

  useEffect(() => {
    const controllers: Partial<Record<Exclude<DataKey, "dams" | "rainRisk" | "rivers" | "tmdWarnings">, AbortController>> = {};
    const replaceController = (key: Exclude<DataKey, "dams" | "rainRisk" | "rivers" | "tmdWarnings">) => {
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
      if (modelEnabled && lastFetched.current.wind !== null && shouldRefresh(lastFetched.current.wind, now, REFRESH.slow)) loadWind();
      if (lastFetched.current.storms !== null && shouldRefresh(lastFetched.current.storms, now, REFRESH.slow)) loadStorms();
      if (lastFetched.current.quakes !== null && shouldRefresh(lastFetched.current.quakes, now, REFRESH.slow)) loadQuakes();
      if (lastFetched.current.dams !== null && shouldRefresh(lastFetched.current.dams, now, REFRESH.slow)) loadDams(true).catch(() => {});
      if (lastFetched.current.rainRisk !== null && shouldRefresh(lastFetched.current.rainRisk, now, 30 * 60_000)) loadRainRisk(true).catch(() => {});
      if (lastFetched.current.rivers !== null && shouldRefresh(lastFetched.current.rivers, now, 6 * 60 * 60_000)) loadRivers(true).catch(() => {});
      if (lastFetched.current.tmdWarnings !== null && shouldRefresh(lastFetched.current.tmdWarnings, now, 15 * 60_000)) loadTmdWarnings(true).catch(() => {});
    };
    const onVisibilityChange = () => { if (document.visibilityState === "visible") refreshOnReturn(); };
    loadRadar();
    if (modelEnabled) loadWind();
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
    };
  }, [loadDams, loadRainRisk, loadRivers, loadTmdWarnings, modelEnabled]);

  useEffect(() => () => {
    damsController.current?.abort();
    rainRiskController.current?.abort();
    riversController.current?.abort();
    tmdWarningsController.current?.abort();
  }, []);

  return { manifest, radarFetchedAt, wind, windSettled, dams, damsStatus, loadDams, damsTrend, loadDamsTrend, damsHistory, loadDamsHistory, rainRisk, rainRiskStatus, loadRainRisk, rivers, riversStatus, loadRivers, tmdWarnings, tmdWarningsStatus, loadTmdWarnings, storms, quakes };
}
