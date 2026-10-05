import { expect, it } from "vitest";
import { reportedIndex, reportedTimes } from "./reported";
import { nextFrameIndex } from "@/lib/radar/frames";

it("sorts reports without filling unreported days and removes invalid/duplicate entries", () => {
  const days = reportedTimes(["2026-01-02", "2025-12-30", "", "invalid", "2026-01-02"]);
  expect(days).toEqual(["2025-12-30", "2026-01-02"]);
  expect(days[nextFrameIndex(0, days.length)]).toBe("2026-01-02");
  expect(reportedIndex(days, "2025-12-31")).toBe(1);
  expect(reportedIndex(days, "2025-12-30")).toBe(0);
  expect(reportedIndex([], null)).toBe(-1);
});
it("uses reported radar timestamps without inventing frames", () => {
  const frames = reportedTimes(["2026-10-05T02:20:00Z", "2026-10-05T02:00:00Z"]);
  expect(frames[nextFrameIndex(1, frames.length)]).toBe("2026-10-05T02:00:00Z");
});
