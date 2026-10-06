"use client";

import { useEffect, useState } from "react";
import { CACHED_AT_HEADER, reportCached } from "@/lib/offline-snapshot";

export type Load<T> = { status: "loading" | "ready" | "error"; data: T | null; loadedAt?: string; cachedAt?: string | null };

export function useWaterSource<T>(url: string, valid: (value: T) => boolean): Load<T> {
  const [state, setState] = useState<Load<T>>({ status: "loading", data: null });
  useEffect(() => {
    const controller = new AbortController();
    fetch(url, { signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error(String(response.status));
      const value = await response.json() as T;
      if (!valid(value)) throw new Error("Invalid response");
      // The service worker stamps responses it serves from its offline cache with the time they were saved.
      const cachedAt = response.headers.get(CACHED_AT_HEADER);
      reportCached(url, cachedAt);
      if (!controller.signal.aborted) setState({ status: "ready", data: value, loadedAt: new Date().toISOString(), cachedAt });
    }).catch(() => { if (!controller.signal.aborted) setState({ status: "error", data: null }); });
    return () => controller.abort();
  }, [url, valid]);
  return state;
}

