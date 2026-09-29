import { MINUTE, nearestIndex } from "./time";

export type RainSource = { kind: "radar"; index: number; frameTime: number } | { kind: "model" } | { kind: "none" };

export function rainSourceAt(t: number, radarTimes: number[], nowMs: number): RainSource {
  if (t > nowMs) return { kind: "model" };
  const index = nearestIndex(t, radarTimes, 30 * MINUTE);
  return index < 0 ? { kind: "none" } : { kind: "radar", index, frameTime: radarTimes[index] };
}
