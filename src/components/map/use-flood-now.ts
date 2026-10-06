"use client";

import { useEffect, useState } from "react";
import type { FloodNowPayload } from "@/components/flood/home-data";
import { floodDate } from "@/lib/map/gibs";

export function useFloodNow(enabled: boolean, nowMs: number): FloodNowPayload | null {
  const day = floodDate(nowMs);
  const [result, setResult] = useState<{ day: string; payload: FloodNowPayload } | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    fetch("/api/flood-now", { signal: controller.signal })
      .then((response) => { if (!response.ok) throw new Error("flood snapshot unavailable"); return response.json() as Promise<FloodNowPayload>; })
      .then((payload) => {
        if (!controller.signal.aborted && typeof payload.date === "string" && Object.keys(payload.provinceCounts ?? {}).length === 77) {
          setResult({ day, payload });
        }
      }).catch(() => { /* Missing observations must not become a zero-flood choropleth. */ });
    return () => controller.abort();
  }, [enabled, day]);
  return result?.day === day ? result.payload : null;
}
