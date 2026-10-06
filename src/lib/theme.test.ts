import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contrastRatio } from "./map/palette";
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

describe("map-first colour roles", () => {
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  const blocks = new Map([...css.matchAll(/([^{};]+)\{([^{}]*)\}/g)].map((match) => [match[1].trim(), match[2]]));
  const roles = ["water", "release", "warn", "model", "nodata", "map-land", "map-edge", "sheet"];

  function tokens(selector: string): Record<string, string> {
    const block = blocks.get(selector);
    expect(block, `Missing palette: ${selector}`).toBeDefined();
    return Object.fromEntries([...(block ?? "").matchAll(/--([\w-]+):\s*([^;]+);/g)].map((match) => [match[1], match[2].trim()]));
  }

  it.each([
    ["light", ":root"],
    ["dark", '[data-theme="dark"], [data-theme="night"]'],
  ])("defines every role and preserves component tokens in %s", (_theme, selector) => {
    const palette = tokens(selector);
    for (const role of roles) {
      expect(palette[role], `Missing role: --${role}`).toMatch(/^#[\da-f]{6}$/i);
      expect(tokens("@theme inline")[`color-${role}`]).toBe(`var(--${role})`);
    }
    expect(palette.card).toBe("var(--sheet)");
    expect(palette.border).toBe("var(--map-edge)");
    for (const token of ["background", "foreground", "muted"]) {
      expect(palette[token]).toMatch(/^#[\da-f]{6}$/i);
    }
    for (const token of ["foreground", "muted", "water", "release", "warn", "model"]) {
      for (const surface of ["background", "sheet"]) {
        expect(contrastRatio(palette[token], palette[surface]), `${token} on ${surface}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("uses cyan water on dark and keeps the night palette on the same roles", () => {
    expect(tokens('[data-theme="dark"], [data-theme="night"]').water).toBe("#22d3ee");
    const night = tokens('[data-theme="night"]');
    for (const token of [...roles, "background", "foreground", "card", "border", "muted"]) {
      expect(night[token]).toBeUndefined();
    }
  });
});
