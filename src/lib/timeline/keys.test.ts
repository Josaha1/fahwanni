import { describe, expect, it } from "vitest";
import { nextTimeForKey } from "./keys";
import { DAY, HOUR, MINUTE, type TimeDomain } from "./time";

const domain: TimeDomain = { start: 0, now: 37 * MINUTE + 20_000, end: 3 * DAY };
const current = DAY + 37 * MINUTE;

describe("timeline keyboard navigation", () => {
  it("moves by ten minutes, one hour with Shift, and one day with Page keys", () => {
    for (const key of ["ArrowRight", "ArrowUp"]) {
      expect(nextTimeForKey(key, false, current, domain)).toBe(current + 10 * MINUTE);
      expect(nextTimeForKey(key, true, current, domain)).toBe(current + HOUR);
    }
    for (const key of ["ArrowLeft", "ArrowDown"]) {
      expect(nextTimeForKey(key, false, current, domain)).toBe(current - 10 * MINUTE);
      expect(nextTimeForKey(key, true, current, domain)).toBe(current - HOUR);
    }
    expect(nextTimeForKey("PageDown", false, current, domain)).toBe(current + DAY);
    expect(nextTimeForKey("PageUp", false, current, domain)).toBe(current - DAY);
  });

  it("rounds to a minute, clamps at both ends, and ignores other keys", () => {
    expect(nextTimeForKey("Home", false, current, domain)).toBe(37 * MINUTE);
    expect(nextTimeForKey("End", false, current, domain)).toBe(domain.end);
    expect(nextTimeForKey("ArrowLeft", false, domain.start, domain)).toBe(domain.start);
    expect(nextTimeForKey("PageDown", false, domain.end, domain)).toBe(domain.end);
    expect(nextTimeForKey("ArrowRight", false, current + 30_000, domain)).toBe(current + 11 * MINUTE);
    expect(nextTimeForKey(" ", false, current, domain)).toBeNull();
  });
});
