import { MINUTE, nearestIndex } from "./time";

export type RainSource = { kind: "radar"; index: number; frameTime: number }
  | { kind: "blend"; index: number; frameTime: number; radarOpacity: number; modelOpacity: number }
  | { kind: "model" } | { kind: "none" };

export function rainSourceAt(t: number, radarTimes: number[], nowMs: number): RainSource {
  if (t > nowMs) {
    const lead = (t - nowMs) / MINUTE;
    if (lead > 60 || !radarTimes.length) return { kind: "model" };
    const index = radarTimes.length - 1;
    return {
      kind: "blend", index, frameTime: radarTimes[index],
      radarOpacity: lead <= 45 ? 0.7 - 0.5 * lead / 45 : 0,
      modelOpacity: lead <= 15 ? 0 : (lead - 15) / 45,
    };
  }
  const index = nearestIndex(t, radarTimes, 30 * MINUTE);
  return index < 0 ? { kind: "none" } : { kind: "radar", index, frameTime: radarTimes[index] };
}
