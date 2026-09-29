/** Solid route width in px from the dam's release (m³/s): 3 px with no data, growing with √release up to 10 px. */
export function flowWidth(releaseCms: number | null): number {
  if (releaseCms === null || !(releaseCms > 0)) return 3;
  return Math.round(Math.min(10, 3 + Math.sqrt(releaseCms) / 4.5) * 2) / 2;
}

/** Dash patterns stepped in turn to make the dashes move along the line (MapLibre "animate a line"). */
export const FLOW_DASH_STEPS: number[][] = [
  [0, 4, 3], [0.5, 4, 2.5], [1, 4, 2], [1.5, 4, 1.5], [2, 4, 1], [2.5, 4, 0.5], [3, 4, 0],
  [0, 0.5, 3, 3.5], [0, 1, 3, 3], [0, 1.5, 3, 2.5], [0, 2, 3, 2], [0, 2.5, 3, 1.5], [0, 3, 3, 1], [0, 3.5, 3, 0.5],
];

export const flowStep = (elapsedMs: number): number => Math.floor(elapsedMs / 60) % FLOW_DASH_STEPS.length;
