import { describe, expect, it } from "vitest";
import { FOCUS, isOn, type Feature } from "./features";

const hidden: Feature[] = [
  "pm25", "airport", "marine", "farm", "longWeekend", "sunMoon", "quake", "enso",
  "favouritesTable", "heatPrimary", "tempPrimary", "cloudPrimary", "himawari",
  "windOverlay", "fireHotspots", "imerg", "bestTime", "yesterday", "seasonChip", "aqiInShare",
];

describe("feature focus", () => {
  it("defaults to flood focus", () => {
    expect(FOCUS).toBe("flood");
    for (const feature of hidden) expect(isOn(feature)).toBe(false);
  });

  it.each(hidden)("hides %s in flood focus and restores it in all focus", (feature) => {
    expect(isOn(feature, "flood")).toBe(false);
    expect(isOn(feature, "all")).toBe(true);
  });
});
