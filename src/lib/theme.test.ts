import { describe, expect, it } from "vitest";
import { resolveTheme } from "./theme";

describe("resolveTheme", () => {
  it.each([
    [20, 59, false, "light"],
    [20, 59, true, "dark"],
    [21, 0, false, "night"],
    [21, 0, true, "night"],
    [5, 59, false, "night"],
    [6, 0, false, "light"],
    [6, 0, true, "dark"],
  ])("selects %s:%s with dark preference %s", (hour, minute, prefersDark, expected) => {
    expect(resolveTheme("auto", hour + minute / 60, prefersDark)).toEqual({ choice: "auto", theme: expected });
  });

  it.each(["light", "dark"] as const)("keeps the explicit %s choice at night", (choice) => {
    expect(resolveTheme(choice, 2, choice === "dark")).toEqual({ choice, theme: choice });
  });
});
