export type FlowColorRole = "water" | "release" | "nodata";
export type FlowBucket = "none" | "slow" | "mid" | "fast";

/** Logarithmic release scale: 0 → 1 px, 2000 m³/s → 8 px; missing reports stay distinguishable by colour/dashes. */
export function flowWidth(releaseCms: number | null): number {
  if (releaseCms === null || !(releaseCms > 0)) return 1;
  return 1 + 7 * Math.log1p(Math.min(releaseCms, 2000)) / Math.log1p(2000);
}

export function flowColorRole(releaseCms: number | null): FlowColorRole {
  if (releaseCms === null) return "nodata";
  return releaseCms >= 100 ? "release" : "water";
}

export function flowBucket(releaseCms: number | null): FlowBucket {
  if (releaseCms === null || !(releaseCms > 0)) return "none";
  return releaseCms < 50 ? "slow" : releaseCms < 200 ? "mid" : "fast";
}
