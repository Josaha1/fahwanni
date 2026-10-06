"use client";

import { useEffect, useState } from "react";
import type { Bbox, FloodRiskPoint } from "@/lib/water/flood-risk";
import { riskBoxes } from "./data";

export function useProvinceRisk(bbox: Bbox) {
  const key = bbox.join(",");
  const [state, setState] = useState<{ key: string; count: number | null; incomplete: boolean; stale: boolean } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    const box = key.split(",").map(Number) as Bbox;
    void (async () => {
      const boxes = riskBoxes(box);
      const points = new Map<string, FloodRiskPoint>();
      let incomplete = false, stale = false, received = 0;
      for (let index = 0; index < boxes.length; index += 4) {
        const results = await Promise.allSettled(boxes.slice(index, index + 4).map(async (cell) => {
          const response = await fetch(`/api/flood-risk?bbox=${cell.join(",")}`, { signal: controller.signal });
          if (!response.ok) throw new Error(String(response.status));
          const data = await response.json() as { points: FloodRiskPoint[]; stale?: boolean };
          if (!Array.isArray(data.points)) throw new Error("Invalid risk response");
          return data;
        }));
        if (controller.signal.aborted) return;
        for (const result of results) {
          if (result.status === "rejected") { incomplete = true; continue; }
          received++;
          stale ||= !!result.value.stale;
          incomplete ||= result.value.points.length >= 2000;
          for (const point of result.value.points) {
            if (point.lon >= box[0] && point.lon <= box[2] && point.lat >= box[1] && point.lat <= box[3]) points.set(point.id, point);
          }
        }
      }
      setState({ key, count: received ? points.size : null, incomplete, stale });
    })();
    return () => controller.abort();
  }, [key]);
  return state?.key === key ? state : { count: null, incomplete: false, stale: false };
}
