import { describe, expect, it } from "vitest";
import { mapShortcut } from "./shortcuts";

describe("map shortcuts", () => {
  it("maps playback, steps, modes and help in both modes", () => {
    expect(mapShortcut({ key: " " }, { mode: "weather" })).toEqual({ type: "togglePlay" });
    expect(mapShortcut({ key: " " }, { mode: "water" })).toEqual({ type: "toggleWaterPlay" });
    expect(mapShortcut({ key: "ArrowLeft" }, { mode: "weather" })).toEqual({ type: "step", direction: -1 });
    expect(mapShortcut({ key: "ArrowRight" }, { mode: "water" })).toEqual({ type: "step", direction: 1 });
    expect(mapShortcut({ key: "W" }, { mode: "weather" })).toEqual({ type: "setMode", mode: "water" });
    expect(mapShortcut({ key: "a" }, { mode: "water" })).toEqual({ type: "setMode", mode: "weather" });
    expect(mapShortcut({ key: "?" }, { mode: "water" })).toEqual({ type: "help" });
    expect(mapShortcut({ key: "Escape" }, { mode: "weather" })).toBeNull();
  });

  it("restricts layer keys to weather mode", () => {
    for (const [key, primary] of [["1", "rain"], ["2", "temp"], ["3", "heat"], ["4", "pm25"], ["5", "cloud"]]) {
      expect(mapShortcut({ key }, { mode: "weather" })).toEqual({ type: "setPrimary", primary });
      expect(mapShortcut({ key }, { mode: "water" })).toBeNull();
    }
  });

  it("ignores editing targets and modifier keys", () => {
    for (const tagName of ["INPUT", "textarea", "Select"]) {
      expect(mapShortcut({ key: " ", target: { tagName } }, { mode: "weather" })).toBeNull();
    }
    expect(mapShortcut({ key: "w", target: { tagName: "span", isContentEditable: true } }, { mode: "weather" })).toBeNull();
    for (const modifier of ["ctrlKey", "metaKey", "altKey"] as const) {
      expect(mapShortcut({ key: "?", [modifier]: true }, { mode: "weather" })).toBeNull();
    }
  });
});
