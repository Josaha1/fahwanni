import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LocaleProvider } from "@/i18n/client";
import fixture from "@/lib/dams/fixture-rid.json";
import { parseRidDams } from "@/lib/dams/rid";
import { DamHero, capacityColor } from "./dam-hero";

const dam = { ...parseRidDams(fixture).dams[0], date: "2026-10-05", storagePct: 110, releaseCms: 100 };
const render = (locale: "th" | "en", release: (number | null)[] = [80]) => renderToStaticMarkup(<LocaleProvider locale={locale}><DamHero dam={dam}
  trend={{ dates: ["2026-10-04"], release: { [dam.id]: release }, pct: {}, inflow: {} }} /></LocaleProvider>);

it.each([[80, "water"], [80.1, "release"], [100, "release"], [100.1, "warn"]] as const)("uses the approved capacity role at %s", (pct, role) => {
  expect(capacityColor(pct)).toBe(`var(--${role})`);
});

it.each(["th", "en"] as const)("renders the overflow ring and one shared source/date for the %s hero", (locale) => {
  const html = render(locale);
  expect(html).toContain('data-overflow="true"');
  expect(html).toContain('stroke="var(--warn)"');
  expect(html).toContain("110%");
  expect(html).toContain("▲ 20");
  expect(html.match(new RegExp(locale === "th" ? "กรมชลประทาน" : "Royal Irrigation Department", "g"))).toHaveLength(1);
  expect(html).toContain(locale === "th" ? "5 ต.ค." : "5 Oct");
  expect(html).not.toContain(locale === "th" ? "4 ต.ค." : "4 Oct");
});

it("does not compare with an older day when yesterday's report is absent", () => {
  const html = renderToStaticMarkup(<LocaleProvider locale="en"><DamHero dam={dam}
    trend={{ dates: ["2026-10-03", "2026-10-04"], release: { [dam.id]: [80, null] }, pct: {}, inflow: {} }} /></LocaleProvider>);
  expect(html).toContain("No report for comparison with yesterday");
  expect(html).not.toContain("▲");
});

it("keeps an actual zero release report for yesterday", () => {
  expect(render("en", [0])).toContain("▲ 100");
});
