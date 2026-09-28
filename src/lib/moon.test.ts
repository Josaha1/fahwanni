import { describe, expect, it } from "vitest";
import { moonPhaseLabel, nextFullMoon } from "./moon";

describe("moonPhaseLabel", () => {
  it.each([
    ["WANING_GIBBOUS", "th", "ข้างแรม (เกือบเต็มดวง)"],
    ["FULL_MOON", "th", "จันทร์เต็มดวง"],
    ["NEW_MOON", "en", "New moon"],
  ] as const)("%s/%s", (phase, locale, label) => expect(moonPhaseLabel(phase, locale)).toBe(label));

  it("is undefined for missing or unknown phases", () => {
    expect(moonPhaseLabel(undefined, "th")).toBeUndefined();
    expect(moonPhaseLabel("BLUE_MOON", "th")).toBeUndefined();
  });
});

describe("nextFullMoon", () => {
  it("finds the first full-moon day", () => {
    expect(nextFullMoon([{ date: "2026-10-24", moonPhase: "WAXING_GIBBOUS" }, { date: "2026-10-26", moonPhase: "FULL_MOON" }])).toBe("2026-10-26");
    expect(nextFullMoon([{ date: "2026-10-01", moonPhase: "WANING_GIBBOUS" }])).toBeUndefined();
  });
});
