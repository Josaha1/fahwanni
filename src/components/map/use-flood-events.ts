"use client";

import { useEffect, useRef, useState } from "react";
import type { FloodEventsPayload } from "@/components/water/flood-events";

/** Loads /api/flood-events once, the first time water mode needs it. */
export function useFloodEvents(enabled: boolean): FloodEventsPayload | null {
  const [payload, setPayload] = useState<FloodEventsPayload | null>(null);
  const started = useRef(false);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);
  useEffect(() => {
    if (!enabled || started.current) return;
    started.current = true;
    fetch("/api/flood-events").then((response) => response.ok ? response.json() as Promise<FloodEventsPayload> : null)
      .then((data) => { if (mounted.current && data && Array.isArray(data.items)) setPayload(data); })
      .catch(() => { /* the layer stays empty */ });
  }, [enabled]);
  return payload;
}
