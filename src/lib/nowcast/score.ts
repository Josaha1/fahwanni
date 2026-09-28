import type { Levels } from "./intensity";

export interface BinaryScore {
  hits: number;
  misses: number;
  falseAlarms: number;
  /** Probability of detection: hits / (hits + misses). */
  pod: number;
  /** False alarm ratio: falseAlarms / (hits + falseAlarms). */
  far: number;
  /** Critical success index: hits / (hits + misses + falseAlarms). */
  csi: number;
}

/** Standard rain/no-rain verification of a forecast grid against the observed grid. */
export function scoreBinary(forecast: Levels, observed: Levels, threshold = 1): BinaryScore {
  let hits = 0, misses = 0, falseAlarms = 0;
  for (let i = 0; i < observed.length; i++) {
    const f = forecast[i] >= threshold, o = observed[i] >= threshold;
    if (f && o) hits++;
    else if (o) misses++;
    else if (f) falseAlarms++;
  }
  const ratio = (a: number, b: number) => (b === 0 ? 0 : a / b);
  return {
    hits, misses, falseAlarms,
    pod: ratio(hits, hits + misses),
    far: ratio(falseAlarms, hits + falseAlarms),
    csi: ratio(hits, hits + misses + falseAlarms),
  };
}
