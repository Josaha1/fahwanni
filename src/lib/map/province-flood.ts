import type { PixelCounts } from "@/lib/flood/viirs";

export function provinceFloodRatio(counts: PixelCounts | null | undefined): number {
  return counts && counts.sampled > 0 ? (counts.flood + counts.recurringFlood) / counts.sampled : 0;
}

/** Normalise sampling-point ratios, not raw counts or hectares, across the country. */
export function provinceFillOpacity(counts: PixelCounts | null | undefined, max: number): number {
  return max > 0 ? Math.sqrt(Math.min(1, Math.max(0, provinceFloodRatio(counts) / max))) : 0;
}

export function isCloudy(counts: PixelCounts | null | undefined): boolean {
  return !counts || counts.sampled <= 0 || counts.insufficientData + counts.noData >= counts.sampled * 0.5;
}
