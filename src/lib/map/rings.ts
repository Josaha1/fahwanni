export const RING_SIZE = 40;

/** Geometry is quantized; the colour role still uses the reported percentage. */
export function ringStep(pct: number): number {
  return Math.floor(Math.max(0, Math.min(120, Number.isNaN(pct) ? 0 : pct)) / 5) * 5;
}

export function ringSprite(pct: number | null | undefined): string {
  if (pct == null || !Number.isFinite(pct)) return "ring-nodata";
  const role = pct > 100 ? "warn" : pct > 80 ? "release" : "water";
  return `ring-${role}-${ringStep(pct)}`;
}
