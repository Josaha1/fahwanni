import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LocaleProvider } from "@/i18n/client";
import { translator } from "@/i18n/core";
import fixture from "@/lib/dams/fixture-rid.json";
import { parseRidDams } from "@/lib/dams/rid";
import { tankFill, visualSummaryTank } from "@/lib/visuals";
import { TimeScrubber } from "@/components/time-scrubber";
import { DamHero, DamTank } from "./dam-hero";

const scrubber = vi.hoisted(() => ({ day: null as string | null, nullStates: 0 }));
vi.mock("react", async (original) => {
  const react = await original<typeof import("react")>();
  return { ...react, useState: (initial: unknown) => {
    const isDay = initial === null && ++scrubber.nullStates === 1;
    const state = react.useState(isDay ? scrubber.day : initial);
    return isDay ? [state[0], (day: string) => { scrubber.day = day; }] : state;
  } };
});
beforeEach(() => {
  scrubber.day = null; scrubber.nullStates = 0;
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-08T12:00:00+07:00"));
});
afterEach(() => vi.useRealTimers());

const dam = { ...parseRidDams(fixture).dams[0], date: "2026-10-05", storagePct: 110 };
const history = { dataDate: dam.date, lastYear: { date: "2025-10-05", pct: { [dam.id]: 0 } }, year2554: { date: "2011-10-05", pct: { [dam.id]: 100 } } };
const trend = { dates: ["2026-10-02", "2026-10-03", "2026-10-04"], pct: { [dam.id]: [80, null, 90] }, release: {}, inflow: {} };

it.each(["th", "en"] as const)("shares one %s caption, day, source and scrubber with the SVG tank", (locale) => {
  const html = renderToStaticMarkup(<LocaleProvider locale={locale}><DamHero dam={dam} trend={trend} history={history} /></LocaleProvider>);
  const date = locale === "th" ? "5 ต.ค." : "5 Oct";
  const summary = `${visualSummaryTank(tankFill(dam.storagePct, 121), translator(locale))} · ${translator(locale)("ข้อมูลวันที่ {date}", { date })}`;
  expect(html).toContain(`aria-label="${summary}"`);
  expect(html).toContain(`<p class="text-muted text-xs">${summary}</p>`);
  expect(html).toContain('type="range" min="0" max="2"');
  expect(html).toContain(`aria-valuetext="${date}"`);
  expect(html).toContain('data-scrub-day="2026-10-05"');
  expect(html).toContain('data-scrub-index="2"');
  expect(html).toContain('fill="currentColor">100%</text>');
  expect(html).not.toMatch(/>[^<]*\d{4}-\d{2}-\d{2}/);
  expect(html).toContain('value="2"');
  expect(html).toContain('data-level="lastYear"');
  expect(html).toContain('data-level="year2554"');
  expect(html).toContain(locale === "th" ? "กรมชลประทาน" : "Royal Irrigation Department");
  const state = JSON.parse(html.match(/data-scene-state="([^"]+)"/)![1].replaceAll("&quot;", '"'));
  expect(state).toMatchObject({ mode: "svg", day: dam.date, pct: 110 });
  expect(state.ghosts).toHaveLength(2);
});

it.each(["th", "en"] as const)("keeps latest-day staleness but removes it during intentional %s replay", (locale) => {
  let changeDay: ((day: string) => void) | undefined;
  function Hero() {
    const tree = DamHero({ dam, trend, history });
    const control = tree.props.children.find((child: unknown) => isValidElement(child) && child.type === TimeScrubber) as ReactElement<{ onChange: typeof changeDay }>;
    changeDay = control.props.onChange;
    return tree;
  }
  const render = () => {
    scrubber.nullStates = 0;
    return renderToStaticMarkup(<LocaleProvider locale={locale}><Hero /></LocaleProvider>);
  };
  const old = locale === "th" ? "ข้อมูลเก่า" : "Old data";
  expect(render()).toContain(old);
  expect(render()).toContain("text-amber-600");
  changeDay!("2026-10-02");
  const html = render();
  const date = locale === "th" ? "2 ต.ค." : "2 Oct";
  const t = translator(locale);
  const summary = `${visualSummaryTank(tankFill(80, 121), t)} · ${t("ข้อมูลวันที่ {date}", { date })}`;
  expect(html).toContain('data-scrub-day="2026-10-02"');
  expect(html).toContain('data-scrub-index="0"');
  expect(html).toContain(`aria-valuetext="${date}"`);
  expect(html).toContain(`aria-label="${summary}"`);
  expect(html).toContain(`<p class="text-muted text-xs">${summary}</p>`);
  expect(html).toContain(`${t("กรมชลประทาน")} · ${t("ข้อมูลวันที่ {date}", { date })}`);
  expect(html).not.toContain(old);
  expect(html).not.toContain("text-amber");
  expect(html).not.toMatch(/>[^<]*\d{4}-\d{2}-\d{2}/);
  expect(html).toContain('fill="currentColor">100%</text>');
  expect(html).toContain('value="0"');
  changeDay!(dam.date);
  expect(render()).toContain(old);
});

it("draws above the capacity crest, keeping historical zero visible", () => {
  const html = renderToStaticMarkup(<DamTank dam={dam} history={history} summary="tank" />);
  expect(html).toContain('y="74" width="226" height="176');
  expect(html).toContain('y1="90" y2="90"');
  expect(html).toMatch(/data-level="lastYear"[^>]+y1="250"/);
  expect(renderToStaticMarkup(<DamTank dam={{ ...dam, date: "2026-10-04" }} history={history} summary="tank" />)).not.toContain("data-level");
});

it("disables the scrubber when there is only one actual report", () => {
  const html = renderToStaticMarkup(<LocaleProvider locale="en"><DamHero dam={dam} /></LocaleProvider>);
  expect(html).toContain('max="0"');
  expect(html).toContain('disabled=""');
  expect(html).not.toContain("data-level");
});
