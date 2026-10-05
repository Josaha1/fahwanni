"use client";

import { useEffect, useMemo, useState } from "react";
import { availableFloodReports, floodReplayDates, type FloodReport } from "@/lib/map/gibs-replay";

export function useFloodReplay(enabled: boolean, nowMs: number): FloodReport[] {
  const newestDay = floodReplayDates(nowMs).at(-1)!;
  const dates = useMemo(() => floodReplayDates(Date.parse(`${newestDay}T12:00:00Z`) + 86_400_000), [newestDay]);
  const newest = dates.at(-1)!;
  const [result, setResult] = useState<{ newest: string; reports: FloodReport[] } | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    void availableFloodReports(dates, controller.signal)
      .then((reports) => { if (!controller.signal.aborted) setResult({ newest, reports }); });
    return () => controller.abort();
  }, [enabled, newest, dates]);
  return result?.newest === newest ? result.reports : [];
}
