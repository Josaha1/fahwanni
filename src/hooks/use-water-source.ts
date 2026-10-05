"use client";

import { useEffect, useState } from "react";

export type Load<T> = { status: "loading" | "ready" | "error"; data: T | null; loadedAt?: string };

export function useWaterSource<T>(url: string, valid: (value: T) => boolean): Load<T> {
  const [state, setState] = useState<Load<T>>({ status: "loading", data: null });
  useEffect(() => {
    const controller = new AbortController();
    fetch(url, { signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error(String(response.status));
      const value = await response.json() as T;
      if (!valid(value)) throw new Error("Invalid response");
      if (!controller.signal.aborted) setState({ status: "ready", data: value, loadedAt: new Date().toISOString() });
    }).catch(() => { if (!controller.signal.aborted) setState({ status: "error", data: null }); });
    return () => controller.abort();
  }, [url, valid]);
  return state;
}

