import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LocaleProvider } from "@/i18n/client";
import { translator } from "@/i18n/core";
import { damSceneSummary } from "@/lib/chart-summaries";
import fixture from "@/lib/dams/fixture-rid.json";
import type { DamHistory } from "@/lib/dams/history";
import { damSceneColors } from "@/lib/dams/schematic";
import { parseRidDams } from "@/lib/dams/rid";
import { DamSection } from "./dam-section";

const dam = parseRidDams(fixture).dams[0];
const history: DamHistory = {
  dataDate: dam.date,
  lastYear: { date: "2025-09-29", pct: { [dam.id]: 50 } },
  year2554: { date: "2011-09-29", pct: { [dam.id]: 100 } },
};
const render = (props: React.ComponentProps<typeof DamSection>, locale: "th" | "en" = "th") =>
  renderToStaticMarkup(<LocaleProvider locale={locale}><DamSection {...props} /></LocaleProvider>);

describe("dam cross-section", () => {
  it.each(["th", "en"] as const)("uses the same %s summary for the SVG and visible text", (locale) => {
    const summary = damSceneSummary(dam, history, translator(locale));
    const html = render({ dam, history, theme: "light" }, locale);
    expect(html).toContain(`role="img" aria-label="${summary}"`);
    expect(html).toContain(`<p class="text-muted text-xs">${summary}</p>`);
    expect(html).toContain('class="w-full text-given" viewBox="0 0 480 320"');
    expect(html).toContain(locale === "th" ? "แผนภาพ ไม่ใช่ระดับน้ำจริง" : "Schematic, not the actual water level");
    expect(html).toContain(locale === "th" ? "ปี 2554 100%" : "2011 100%");
  });

  it("draws both historical levels with the shared schematic curve", () => {
    const html = render({ dam, history, theme: "light" });
    expect(html).toMatch(/data-level="last-year"[^>]*y1="[^"]+"[^>]*stroke="#64748b"/);
    expect(html).toMatch(/data-level="2554"[^>]*y1="70" y2="70" stroke="#e11d48"/);
  });

  it("omits history with a different data date", () => {
    const html = render({ dam, history: { ...history, dataDate: "2000-01-01" }, theme: "dark" });
    expect(html).not.toContain("data-level=");
    expect(html).not.toContain("ปีที่แล้ว");
    expect(html).not.toContain("ปี 2554");
  });

  it("omits absent, missing and non-finite historical values", () => {
    for (const value of [undefined, null, { ...history, lastYear: null, year2554: { date: "2011-09-29", pct: {} } },
      { ...history, lastYear: { date: "2025-09-29", pct: { [dam.id]: NaN } }, year2554: null }]) {
      expect(render({ dam, history: value, theme: "light" })).not.toContain("data-level=");
    }
  });

  it("only draws positive release and steps its width through three sizes", () => {
    for (const releaseCms of [null, 0, -1]) {
      expect(render({ dam: { ...dam, releaseCms }, theme: "light" })).not.toContain('data-release="arrow"');
    }
    for (const [releaseCms, width] of [[1, 3], [100, 6], [500, 9]]) {
      const html = render({ dam: { ...dam, releaseCms }, theme: "light" });
      expect(html).toContain('data-release="arrow"');
      expect(html).toContain(`stroke-width="${width}" stroke-linecap="round"`);
    }
  });

  it.each(["light", "dark"] as const)("uses the shared %s scene palette", (theme) => {
    const html = render({ dam, theme });
    const colors = damSceneColors(theme, dam.band);
    for (const color of [colors.background, colors.terrain, colors.wall, colors.water]) {
      expect(html).toContain(`fill="${color}"`);
    }
  });
});
