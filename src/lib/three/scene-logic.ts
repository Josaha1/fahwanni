import type { GlTier } from "./gl-tier";

export type ViewFlags = { visible: boolean; dirty: boolean; animating: boolean };
export type Rect = { left: number; top: number; width: number; height: number };
export type GlRect = { x: number; y: number; width: number; height: number };

export function shouldRender(view: ViewFlags, tier: GlTier): boolean {
  return tier !== "svg" && view.visible && (view.dirty || (tier === "full" && view.animating));
}

/** Keep the original viewport when partially clipped, otherwise scrolling distorts the scene. */
export function scissorRects(rect: Rect, width: number, height: number): { viewport: GlRect; scissor: GlRect } | null {
  if (![rect.left, rect.top, rect.width, rect.height, width, height].every(Number.isFinite)
    || rect.width <= 0 || rect.height <= 0 || width <= 0 || height <= 0) return null;
  const left = Math.max(0, rect.left), top = Math.max(0, rect.top);
  const right = Math.min(width, rect.left + rect.width), bottom = Math.min(height, rect.top + rect.height);
  if (right <= left || bottom <= top) return null;
  return {
    viewport: { x: rect.left, y: height - rect.top - rect.height, width: rect.width, height: rect.height },
    scissor: { x: left, y: height - bottom, width: right - left, height: bottom - top },
  };
}

export function cappedDpr(dpr: number, tier: GlTier): number {
  return Math.min(Number.isFinite(dpr) && dpr > 0 ? dpr : 1, tier === "full" ? 1.5 : 1);
}

export type FrameWatchdog = { samples: readonly number[]; avgFrameMs: number };

export function sampleFrame(watchdog: FrameWatchdog, frameMs: number): FrameWatchdog {
  if (!Number.isFinite(frameMs) || frameMs <= 0) return watchdog;
  const samples = [...watchdog.samples, frameMs].slice(-30);
  return { samples, avgFrameMs: samples.reduce((sum, ms) => sum + ms, 0) / samples.length };
}
