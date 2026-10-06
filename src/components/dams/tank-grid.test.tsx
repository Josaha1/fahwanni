import { expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LocaleProvider } from "@/i18n/client";
import { translator } from "@/i18n/core";
import fixture from "@/lib/dams/fixture-rid.json";
import { parseRidDams } from "@/lib/dams/rid";
import { DAM_REGISTRY } from "@/lib/dams/registry";
import { visualSummaryTank } from "@/lib/visuals";
import { tankGridData } from "./tank-grid-data";
import { TankGrid } from "./tank-grid";
import { GridTankSvg } from "./tank-svg";

const motion = vi.hoisted(() => ({ reducedMotion: false }));
vi.mock("@/hooks/use-lite", () => ({ useLite: () => ({ lite: true, ...motion }) }));
const parsed = parseRidDams(fixture);
const date = parsed.dataDate!;
const first = { ...parsed.dams[0], storagePct: 110, releaseCms: 1500, inflowCms: 500 };

it.each(["th", "en"] as const)("renders 35 compact SVG cards with accessible captions, state and routes (%s)", (locale) => {
  const html = renderToStaticMarkup(<LocaleProvider locale={locale}><TankGrid dams={[first]} date={date} trend={null} /></LocaleProvider>);
  expect(html.match(/data-scene-state=/g)).toHaveLength(35);
  expect(html.match(/<svg /g)).toHaveLength(35);
  expect(html.match(/role="img"/g)).toHaveLength(35);
  expect(html.match(/class="h-14 text-given"/g)).toHaveLength(35);
  expect(html).toContain("grid-cols-4 gap-1 min-[360px]:grid-cols-5");
  expect(html.match(/h-\[104px\]/g)).toHaveLength(35);
  const visible = html.replace(/<[^>]*>/g, "");
  for (const entry of tankGridData([first], date, null)) {
    expect(html).toContain(`href="/dam/${entry.id}"`);
    expect(html).toContain(`aria-label="${visualSummaryTank(entry.fill, translator(locale))}"`);
    expect(visible).not.toContain(visualSummaryTank(entry.fill, translator(locale)));
  }
  const states = [...html.matchAll(/data-scene-state="([^"]+)"/g)].map((match) => JSON.parse(match[1].replaceAll("&quot;", '"')));
  expect(states.find((entry) => entry.id === first.id)).toEqual({ mode: "svg", id: first.id, pct: 110, release: 1500, inflow: 500 });
  expect(states.filter((entry) => entry.pct === null)).toHaveLength(34);
  expect(html).toContain(translator(locale)("ไม่มีรายงาน"));
  expect(visible.match(new RegExp(translator(locale)("กรมชลประทาน"), "g"))).toHaveLength(1);
  const legend = translator(locale)("เส้นประ = เต็มความจุ 100% · ลูกศร = ไหลเข้า/ระบาย");
  expect(visible.split(legend)).toHaveLength(2);
  const cards = [...html.matchAll(/<a [\s\S]*?<\/a>/g)].map((match) => match[0].replace(/<[^>]*>/g, ""));
  expect(cards).toHaveLength(35);
  for (const [index, entry] of tankGridData([first], date, null).entries()) {
    const name = locale === "en" ? entry.nameEn : entry.nameTh;
    expect(cards[index]).toBe(`${name}${entry.fill.state === "data" ? "110%" : "—"} —`);
  }
  expect(html).not.toContain("<text");
  expect(html).not.toContain("<canvas");
});

it("keeps >100% above the crest, caps streams and distinguishes a reported zero from missing", () => {
  const entries = tankGridData([first, { ...parsed.dams[1], storagePct: 0, releaseCms: 0, inflowCms: null }], date, null);
  const entry = entries.find((entry) => entry.id === first.id)!;
  const html = renderToStaticMarkup(<GridTankSvg entry={entry} />);
  expect(html).toContain('data-tank-fill="" d="M42 30 ');
  expect(html).toContain('y1="40" y2="40"');
  expect(html).toContain('data-stream="release"');
  expect(html).toContain('stroke-width="6"');
  expect(html).toContain('stroke-width="3"');
  expect(entry.release).toMatchObject({ value: 1500, ratio: 1, capped: true });
  const zero = entries.find((entry) => entry.id === parsed.dams[1].id)!;
  expect(zero.state).toMatchObject({ pct: 0, release: 0, inflow: null });
  expect(renderToStaticMarkup(<GridTankSvg entry={zero} />)).not.toContain('data-stream=');
  const missing = entries.find((entry) => entry.fill.state === "no-data")!;
  expect(renderToStaticMarkup(<GridTankSvg entry={missing} />)).toMatch(/fill="url\(#missing-[^)]+\)"/);
});

it("uses only today's RID reports and exact yesterday for arrows", () => {
  const yesterday = new Date(Date.parse(`${date}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);
  const trend = { dates: [yesterday], pct: { [first.id]: [100] }, release: {}, inflow: {} };
  expect(tankGridData([first], date, trend).find((entry) => entry.id === first.id)?.change).toBe(10);
  expect(tankGridData([first], date, { ...trend, dates: ["2000-01-01"] }).find((entry) => entry.id === first.id)?.change).toBeNull();
  const stale = tankGridData([{ ...first, date: yesterday }], date, trend);
  expect(stale).toHaveLength(DAM_REGISTRY.length);
  expect(stale.every((entry) => entry.state.pct === null && entry.change === null)).toBe(true);
  expect(tankGridData([], null, null).every((entry) => entry.fill.state === "no-data")).toBe(true);
});

it("keeps the grid SVG-only and removes wave animation when reduced motion is requested", () => {
  motion.reducedMotion = true;
  try {
    const html = renderToStaticMarkup(<LocaleProvider locale="th"><TankGrid dams={[first]} date={date} trend={null} /></LocaleProvider>);
    expect(html).not.toContain('class="tank-wave"');
    expect(html).not.toContain("<canvas");
    expect(html.match(/&quot;mode&quot;:&quot;svg&quot;/g)).toHaveLength(35);
  } finally { motion.reducedMotion = false; }
});
