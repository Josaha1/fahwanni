import { MINUTE, type TimeDomain } from "./time";

/** Simulated minutes per real second; shown as ×1 / ×2 / ×4. */
export const PLAY_SPEEDS = [30, 60, 120] as const;
export type PlaySpeed = (typeof PLAY_SPEEDS)[number];
export const DEFAULT_PLAY_SPEED: PlaySpeed = 60;

export function isPlaySpeed(value: unknown): value is PlaySpeed {
  return PLAY_SPEEDS.includes(value as PlaySpeed);
}

export function nextPlaySpeed(speed: PlaySpeed): PlaySpeed {
  return PLAY_SPEEDS[(PLAY_SPEEDS.indexOf(speed) + 1) % PLAY_SPEEDS.length];
}

/** Advances playback by a real frame delta; past the end (or the last data) it wraps to the start. */
export function advance(t: number, dtMs: number, speed: number, domain: TimeDomain, lastAvailable?: number | null): { t: number; wrapped: boolean } {
  const end = Math.min(domain.end, lastAvailable ?? domain.end);
  const next = t + (dtMs / 1000) * speed * MINUTE;
  return next > end ? { t: domain.start, wrapped: true } : { t: next, wrapped: false };
}
