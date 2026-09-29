import { describe, expect, it } from "vitest";
import { DEFAULT_PLAY_SPEED, PLAY_SPEEDS, advance, isPlaySpeed, nextPlaySpeed } from "./play";
import { HOUR, MINUTE, type TimeDomain } from "./time";

const domain: TimeDomain = { start: 0, now: HOUR, end: 10 * HOUR };

describe("play", () => {
  it("advances simulated minutes per real second", () => {
    expect(advance(HOUR, 1000, 60, domain)).toEqual({ t: 2 * HOUR, wrapped: false });
    expect(advance(HOUR, 500, 30, domain).t).toBe(HOUR + 15 * MINUTE);
    expect(advance(HOUR, 2000, 120, domain).t).toBe(5 * HOUR);
  });

  it("wraps to the start past the end", () => {
    expect(advance(10 * HOUR - MINUTE, 1000, 60, domain)).toEqual({ t: 0, wrapped: true });
  });

  it("stops at the last available data when it ends before the domain", () => {
    expect(advance(3 * HOUR, 1000, 60, domain, 3.5 * HOUR)).toEqual({ t: 0, wrapped: true });
    expect(advance(3 * HOUR, 1000, 60, domain, null).t).toBe(4 * HOUR);
  });

  it("cycles and validates speeds", () => {
    expect(PLAY_SPEEDS).toEqual([30, 60, 120]);
    expect(DEFAULT_PLAY_SPEED).toBe(60);
    expect(nextPlaySpeed(30)).toBe(60);
    expect(nextPlaySpeed(120)).toBe(30);
    expect(isPlaySpeed(60)).toBe(true);
    expect(isPlaySpeed("60")).toBe(false);
    expect(isPlaySpeed(45)).toBe(false);
  });
});
