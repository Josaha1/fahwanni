export const detents = ["peek", "half", "full"] as const;
export type Detent = typeof detents[number];

export function detentOffsets(height: number, peekHeight = 360): Record<Detent, number> {
  const full = Math.max(0, height * 0.04);
  const peek = Math.max(full, height - peekHeight);
  return { full, half: Math.min(peek, Math.max(full, height * 0.45)), peek };
}

export function snapDetent(y: number, velocity: number, offsets: Record<Detent, number>): Detent {
  const projected = y + Math.max(-1200, Math.min(1200, velocity)) * 0.15;
  return detents.reduce((best, next) => Math.abs(offsets[next] - projected) < Math.abs(offsets[best] - projected) ? next : best, "peek");
}

export function nextDetent(detent: Detent): Detent {
  return detents[(detents.indexOf(detent) + 1) % detents.length];
}
