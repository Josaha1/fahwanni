import { describe, expect, it } from "vitest";
import { lastRadarFrames, minutesSinceNewest, nextFrameIndex, radarAgeLabel } from "./frames";
import type { RadarFrame } from "./types";

const frames: RadarFrame[] = Array.from({ length: 8 }, (_, index) => ({
  time: new Date(Date.UTC(2026, 8, 28, 7, index * 10)).toISOString(),
  tileUrl: `https://example.com/${index}/{z}/{x}/{y}.png`,
}));

describe("radar frames", () => {
  it("keeps at most the newest six in chronological order", () => {
    expect(lastRadarFrames(frames)).toEqual(frames.slice(2));
    expect(lastRadarFrames(frames.slice(0, 2))).toEqual(frames.slice(0, 2));
    expect(lastRadarFrames(frames, 0)).toEqual([]);
  });

  it("advances and loops, including an empty manifest", () => {
    expect(nextFrameIndex(2, 6)).toBe(3);
    expect(nextFrameIndex(5, 6)).toBe(0);
    expect(nextFrameIndex(0, 0)).toBe(0);
  });

  it("uses the newest frame age and clamps future frames", () => {
    expect(minutesSinceNewest(frames, "2026-09-28T08:12:00Z")).toBe(2);
    expect(minutesSinceNewest(frames, "2026-09-28T08:00:00Z")).toBe(0);
    expect(minutesSinceNewest([], "2026-09-28T08:12:00Z")).toBe(0);
  });

  it("warns when the frame is over 30 minutes old or the manifest is stale", () => {
    expect(radarAgeLabel(30, undefined)).toEqual({ key: "อัปเดตเมื่อ {n} นาทีที่แล้ว", warn: false });
    expect(radarAgeLabel(30, false)).toEqual({ key: "อัปเดตเมื่อ {n} นาทีที่แล้ว", warn: false });
    expect(radarAgeLabel(31, false)).toEqual({ key: "เรดาร์ล่าช้า {n} นาที", warn: true });
    expect(radarAgeLabel(5, true)).toEqual({ key: "เรดาร์ล่าช้า {n} นาที", warn: true });
  });
});
