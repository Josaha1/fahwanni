"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { shouldRefresh } from "@/lib/map/refresh";
import { daysToLoad, localDayIndex, mergeDays, type HourlySeries, type Pm25Var, type WindVar } from "@/lib/timeline/store";
import type { ForecastDay } from "@/lib/wind/days";
import type { Pm25Day } from "@/lib/pm25/days";

const WIND_VARS: WindVar[] = ["u", "v", "precip", "prob", "temp", "feels", "cloud"];
const PM25_VARS: Pm25Var[] = ["pm25"];
const RETRY_MS = 60_000;
const REFRESH_MS = 3 * 60 * 60_000;

type Chunk = { hours: string[]; [variable: string]: string[] | Float32Array[] };
type Failure = { at: number; permanent: boolean };

function idle(callback: () => void): () => void {
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(callback);
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(callback, 1500);
  return () => window.clearTimeout(id);
}

export function useForecastDays({ source, enabled, focusTime, nowMs }: {
  source: "wind" | "pm25"; enabled: boolean; focusTime: number | null; nowMs: number;
}): { series: HourlySeries | null; loadedDays: number[]; loading: boolean; error: boolean; lastAvailable: number | null } {
  const chunks = useRef(new Map<number, Chunk>());
  const failures = useRef(new Map<number, Failure>());
  const requests = useRef(new Map<number, AbortController>());
  const lastFetched = useRef<number | null>(null);
  const [snapshot, setSnapshot] = useState<{ chunks: Map<number, Chunk>; loading: boolean; error: boolean }>(() => ({ chunks: new Map(), loading: false, error: false }));
  const changed = useCallback(() => setSnapshot({ chunks: new Map(chunks.current), loading: requests.current.size > 0, error: !chunks.current.has(0) && failures.current.has(0) }), []);
  const vars = source === "wind" ? WIND_VARS : PM25_VARS;

  useEffect(() => {
    if (enabled || !failures.current.size) return;
    failures.current.clear();
    changed();
  }, [enabled, changed]);

  const loadDay = useCallback(async (day: number): Promise<void> => {
    if (day < 0 || day > 6 || chunks.current.has(day) || requests.current.has(day)) return;
    const failure = failures.current.get(day);
    if (failure && (failure.permanent || Date.now() - failure.at < RETRY_MS)) return;
    failures.current.delete(day);
    const controller = new AbortController();
    requests.current.set(day, controller);
    changed();
    try {
      const response = await fetch(`/api/${source}?day=${day}`, { signal: controller.signal });
      if (response.status === 404) {
        failures.current.set(day, { at: Date.now(), permanent: true });
        return;
      }
      if (!response.ok) throw new Error(`${source} day ${day}: ${response.status}`);
      const data = await response.json() as ForecastDay | Pm25Day;
      if (controller.signal.aborted) return;
      const chunk: Chunk = { hours: data.hours };
      for (const variable of vars) {
        const rows = source === "wind"
          ? (data as ForecastDay)[variable as WindVar]
          : (data as Pm25Day)[variable as Pm25Var];
        if (rows) chunk[variable] = rows.map((row) => Float32Array.from(row));
      }
      chunks.current.set(day, chunk);
      lastFetched.current = Date.now();
    } catch {
      if (!controller.signal.aborted) failures.current.set(day, { at: Date.now(), permanent: false });
    } finally {
      if (requests.current.get(day) === controller) {
        requests.current.delete(day);
        changed();
      }
    }
  }, [source, vars, changed]);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    let cancelIdle: (() => void) | undefined;
    const pending = requests.current;
    void loadDay(0).then(() => {
      if (!active || !chunks.current.has(0)) return;
      const prefetch = (day: number) => {
        cancelIdle = idle(() => {
          void loadDay(day).then(() => {
            if (active && day === 1) prefetch(2);
          });
        });
      };
      prefetch(1);
    });
    return () => {
      active = false;
      cancelIdle?.();
      for (const controller of pending.values()) controller.abort();
      pending.clear();
    };
  }, [enabled, loadDay]);

  useEffect(() => {
    if (!enabled || focusTime === null) return;
    const day = localDayIndex(focusTime, nowMs);
    const failed = new Set([...failures.current].filter(([, failure]) => failure.permanent || Date.now() - failure.at < RETRY_MS).map(([index]) => index));
    const needed = daysToLoad(day, new Set(chunks.current.keys()), failed);
    void loadDay(day);
    if (needed.includes(day + 1)) {
      const cancel = idle(() => { void loadDay(day + 1); });
      return cancel;
    }
  }, [enabled, focusTime, nowMs, loadDay]);

  useEffect(() => {
    if (!enabled) return;
    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible" || lastFetched.current === null || !shouldRefresh(lastFetched.current, Date.now(), REFRESH_MS)) return;
      for (const controller of requests.current.values()) controller.abort();
      requests.current.clear();
      chunks.current.clear();
      failures.current.clear();
      lastFetched.current = null;
      changed();
      void loadDay(0);
      if (focusTime !== null) void loadDay(localDayIndex(focusTime, nowMs));
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [enabled, focusTime, nowMs, loadDay, changed]);

  const loadedDays = useMemo(() => [...snapshot.chunks.keys()].sort((a, b) => a - b), [snapshot.chunks]);
  const series = useMemo(() => loadedDays.length ? mergeDays(loadedDays.map((day) => snapshot.chunks.get(day)!), vars) : null, [loadedDays, snapshot.chunks, vars]);
  return { series, loadedDays, loading: snapshot.loading, error: snapshot.error, lastAvailable: series?.times.at(-1) ?? null };
}
