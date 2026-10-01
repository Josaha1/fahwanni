"use client";

import { useEffect, useRef, useState } from "react";
import type { DwrReservoir } from "@/lib/dams/dwr";
import { buildReservoirPoints, type OsmDam, type ReservoirPoint } from "@/lib/dams/reservoirs";

export type ReservoirsState = { points: ReservoirPoint[] | null; status: "idle" | "loading" | "ready" | "error" };

/** Loads DWR reservoirs (/api/dams-all) and the OSM dam snapshot once, the first time the layer is shown. */
export function useReservoirs(enabled: boolean): ReservoirsState {
  const [state, setState] = useState<ReservoirsState>({ points: null, status: "idle" });
  // Started once; the request must not be cancelled by its own "loading" state change.
  const started = useRef(false);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);
  useEffect(() => {
    if (!enabled || started.current) return;
    started.current = true;
    queueMicrotask(() => { if (mounted.current) setState((current) => ({ ...current, status: "loading" })); });
    Promise.allSettled([
      fetch("/api/dams-all").then((response) => response.ok ? response.json() as Promise<{ reservoirs?: DwrReservoir[] }> : Promise.reject(new Error(String(response.status)))),
      fetch("/data/osm-dams.json").then((response) => response.ok ? response.json() as Promise<{ dams?: OsmDam[] }> : Promise.reject(new Error(String(response.status)))),
    ]).then(([dwr, osm]) => {
      if (!mounted.current) return;
      const dwrList = dwr.status === "fulfilled" && Array.isArray(dwr.value.reservoirs) ? dwr.value.reservoirs : [];
      const osmList = osm.status === "fulfilled" && Array.isArray(osm.value.dams) ? osm.value.dams : [];
      // Either source alone is still worth showing; both failing is an error.
      setState(dwrList.length || osmList.length
        ? { points: buildReservoirPoints(dwrList, osmList), status: "ready" } : { points: null, status: "error" });
    });
  }, [enabled]);
  return state;
}
