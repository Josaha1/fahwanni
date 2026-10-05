import { validateStyleMin } from "@maplibre/maplibre-gl-style-spec";
import type { LayerSpecification, StyleSpecification } from "maplibre-gl";
import { describe, expect, it } from "vitest";
import ofmDark from "./fixture-ofm-dark.json";
import ofmPositron from "./fixture-ofm-positron.json";
import { BASE, baseStyle, mapThemeFor, STYLE_URLS, type BaseTheme } from "./base-style";
import { contrastRatio } from "./palette";

const fixtures: Record<BaseTheme, StyleSpecification> = {
  light: ofmPositron as StyleSpecification,
  dark: ofmDark as StyleSpecification,
};

function layer(style: StyleSpecification, id: string): LayerSpecification {
  const found = style.layers.find((item) => item.id === id);
  if (!found) throw new Error(`Missing layer: ${id}`);
  return found;
}

describe.each(["light", "dark"] as const)("baseStyle %s", (theme) => {
  const source = fixtures[theme];

  it("clones the source and preserves its resources and layer order", () => {
    const snapshot = structuredClone(source);
    const result = baseStyle(theme, source);
    expect(source).toEqual(snapshot);
    expect(result).not.toBe(source);
    expect(result.sources).toEqual(source.sources);
    expect(result.sources).not.toBe(source.sources);
    expect(result.glyphs).toBe(source.glyphs);
    expect(result.sprite).toEqual(source.sprite);
    expect(result.layers.map((item) => item.id)).toEqual(source.layers.map((item) => item.id));
  });

  it("produces a valid style without glow, neon, or blurred lines", () => {
    const result = baseStyle(theme, source);
    expect(validateStyleMin(result)).toEqual([]);
    for (const item of result.layers) {
      expect(item.id).not.toMatch(/neon|glow/i);
      if (item.type === "line") expect(Number(item.paint?.["line-blur"] ?? 0)).toBeLessThanOrEqual(0);
    }
  });

  it("keeps every font in the theme's glyph set and styles symbols", () => {
    const available = new Set(theme === "light"
      ? ["Noto Sans Regular", "Noto Sans Bold", "Noto Sans Italic"]
      : ["Noto Sans Regular"]);
    for (const original of source.layers.filter((item) => item.type === "symbol")) {
      const symbol = layer(baseStyle(theme, source), original.id);
      if (symbol.type !== "symbol") throw new Error(`Expected symbol: ${original.id}`);
      expect(symbol.layout?.["text-font"]).toEqual(original.layout?.["text-font"]);
      const fonts = symbol.layout?.["text-font"];
      if (fonts !== undefined) {
        if (!Array.isArray(fonts)) throw new Error(`Expected font list: ${original.id}`);
        for (const font of fonts) expect(available.has(String(font))).toBe(true);
      }
      expect(symbol.paint?.["text-color"]).toBe(/^place_(country|state|city)/.test(original.id) ? BASE[theme].label : BASE[theme].labelMuted);
      expect(symbol.paint?.["text-halo-color"]).toBe(BASE[theme].halo);
      expect(symbol.paint?.["text-halo-width"]).toBe(1.4);
    }
  });

  it("keeps country boundaries off maritime features and preserves their width", () => {
    const country = source.layers.find((item) => item.id.startsWith("boundary_country_"));
    const input = structuredClone(source);
    if (!country) input.layers.push({
      id: "boundary_country_test", type: "line", source: "openmaptiles", "source-layer": "boundary",
      filter: ["==", ["get", "admin_level"], 2], paint: { "line-color": "#000000" },
    });
    const result = baseStyle(theme, input);
    for (const original of input.layers.filter((item) => item.id.startsWith("boundary_country_"))) {
      const border = layer(result, original.id);
      if (border.type !== "line" || original.type !== "line") throw new Error(`Expected country line: ${original.id}`);
      expect(border.filter).toEqual(["all", original.filter, ["!=", ["get", "maritime"], 1]]);
      expect(border.paint?.["line-color"]).toBe(BASE[theme].border);
      expect(border.paint?.["line-width"]).toEqual(["interpolate", ["linear"], ["zoom"], 3, 1, 22, 1.5]);
      expect(border.paint?.["line-opacity"]).toBe(1);
    }
  });

  it("uses the theme's base colors and sky", () => {
    const result = baseStyle(theme, source);
    expect(layer(result, "background")).toMatchObject({ paint: { "background-color": BASE[theme].bg } });
    expect(layer(result, "water")).toMatchObject({ paint: { "fill-color": BASE[theme].water } });
    expect(layer(result, "building")).toMatchObject({ paint: { "fill-color": BASE[theme].roadDim, "fill-opacity": 0.6 } });
    for (const item of result.layers.filter((entry) => entry.type === "fill" && /^(landcover|landuse)_/.test(entry.id))) {
      if (item.type !== "fill") continue;
      expect(item.paint?.["fill-color"]).toBe(item.id.includes("wood") || item.id.includes("park") ? BASE[theme].landAlt : BASE[theme].land);
      expect(item.paint).not.toHaveProperty("fill-pattern");
    }
    expect(result.sky).toMatchObject({
      "sky-color": BASE[theme].sky.sky,
      "horizon-color": BASE[theme].sky.horizon,
      "fog-color": BASE[theme].sky.fog,
    });
  });

  it("meets text contrast thresholds", () => {
    expect(contrastRatio(BASE[theme].label, BASE[theme].bg)).toBeGreaterThanOrEqual(7);
    expect(contrastRatio(BASE[theme].labelMuted, BASE[theme].bg)).toBeGreaterThanOrEqual(4.5);
  });
});

it("uses the approved OpenFreeMap style URLs", () => {
  expect(STYLE_URLS).toEqual({
    light: "https://tiles.openfreemap.org/styles/positron",
    dark: "https://tiles.openfreemap.org/styles/dark",
  });
});

it.each([
  ["light", "light"],
  ["dark", "dark"],
  ["night", "dark"],
  [undefined, "dark"],
] as const)("maps app theme %s to %s basemap", (appTheme, expected) => {
  expect(mapThemeFor(appTheme)).toBe(expected);
});
