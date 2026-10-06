import { readFileSync } from "node:fs";
import fixture from "@/lib/dams/fixture-rid.json";
import { parseRidDams } from "@/lib/dams/rid";
import { beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LocaleProvider } from "@/i18n/client";
import type { Load } from "@/hooks/use-water-source";
import { damRegistryById } from "@/lib/dams/registry";
import { DamDetail } from "./dam-detail";

const { sources } = vi.hoisted(() => ({ sources: new Map<string, Load<unknown>>() }));
vi.mock("@/hooks/use-water-source", () => ({ useWaterSource: (url: string) => sources.get(url) ?? { status: "error", data: null } }));

beforeEach(() => {
  sources.clear();
  sources.set("/api/dams", { status: "ready", data: { dataDate: "2026-10-05", dams: [] } });
});

const comparison = () => {
  const html = renderToStaticMarkup(<LocaleProvider locale="th"><DamDetail registered={damRegistryById.get("200101")!} /></LocaleProvider>);
  return html.split('aria-label="ปริมาณน้ำในเขื่อน: วันเดียวกันในอดีต">')[1]?.split("</section>")[0];
};

it.each([
  ["2025-10-05", "2011-10-05", "5 ต.ค. 2568", "5 ต.ค. 2554"],
  ["2025-09-29", "2011-09-29", "29 ก.ย. 2568", "29 ก.ย. 2554"],
])("shows historical API dates with Buddhist years without staleness (%s)", (lastYear, year2554, lastYearLabel, year2554Label) => {
  sources.set("/api/dams-history", { status: "ready", data: {
    dataDate: "2026-10-05",
    lastYear: { date: lastYear, pct: { "200101": 88.7 } },
    year2554: { date: year2554, pct: { "200101": 97.2 } },
  } });
  const html = comparison();
  expect(html).toContain("ปีที่แล้ว 88.7%");
  expect(html).toContain("2554 97.2%");
  expect(html).toContain(lastYearLabel);
  expect(html).toContain("ที่มา: กรมชลประทาน");
  expect(html).toContain(year2554Label);
  expect(html).not.toContain("ข้อมูลเก่า");
  expect(html).not.toContain("text-amber");
  expect(html).not.toContain("2569");
  expect(html).not.toContain("ข้อมูลวันที่");
});

it("keeps absent historical dates unknown instead of substituting today's date", () => {
  sources.set("/api/dams-history", { status: "ready", data: { dataDate: "2026-10-05", lastYear: null, year2554: null } });
  const html = comparison();
  expect(html).toContain("ไม่พบข้อมูลในวันที่เปรียบเทียบ");
  expect(html).toContain("ไม่ทราบวันที่ข้อมูล");
  expect(html).toContain("ที่มา: กรมชลประทาน");
  expect(html).not.toContain("ข้อมูลเก่า");
  expect(html).not.toContain("2569");
  expect(html).not.toContain("ข้อมูลวันที่");
});

it.each(["th", "en"] as const)("keeps %s historical dates inline with one shared source", (locale) => {
  sources.set("/api/dams-history", { status: "ready", data: {
    dataDate: "2026-10-05",
    lastYear: { date: "2025-10-05", pct: { "200101": 0 } },
    year2554: { date: "2011-10-05", pct: { "200101": 97.2 } },
  } });
  const html = renderToStaticMarkup(<LocaleProvider locale={locale}><DamDetail registered={damRegistryById.get("200101")!} /></LocaleProvider>);
  const section = html.split('class="dam-history"')[1].split("</section>")[0];
  expect(section).toContain("0%");
  expect(section).toContain("97.2%");
  expect(section.match(new RegExp(locale === "th" ? "กรมชลประทาน" : "Royal Irrigation Department", "g"))).toHaveLength(1);
  expect(section).toContain(locale === "th" ? "5 ต.ค. 2568" : "5 Oct 2025");
  expect(section).toContain(locale === "th" ? "5 ต.ค. 2554" : "5 Oct 2011");
  expect(html).toContain('href="/?province=tak"');
  expect(html.indexOf('href="/?province=tak"')).toBeLessThan(html.indexOf('href="/?province=bangkok"'));
  expect(html).not.toContain('href="/river/');
  if (locale === "en") expect(html).not.toMatch(/[ก-๙]/);
});

it("omits comparisons for a different report date and omits missing OSM polygons", () => {
  sources.set("/api/dams-history", { status: "ready", data: { dataDate: "2026-10-04", lastYear: { date: "2025-10-04", pct: { "200101": 99.9 } }, year2554: null } });
  const html = renderToStaticMarkup(<LocaleProvider locale="en"><DamDetail registered={damRegistryById.get("200101")!} /></LocaleProvider>);
  expect(html).not.toContain("99.9");
  expect(html).not.toContain("Reservoir shape from OpenStreetMap");
});


it.each(["200101", "100301"])("constrains the %s downstream strip and charts and offers one combined table", (id) => {
  const dam = { ...parseRidDams(fixture).dams.find((dam) => dam.id === id)!, date: "2026-10-06" };
  sources.set("/api/dams", { status: "ready", data: { dataDate: dam.date, dams: [dam] } });
  sources.set("/api/dams-trend", { status: "ready", data: {
    dates: [dam.date], release: { [id]: [dam.releaseCms] }, inflow: { [id]: [dam.inflowCms] }, pct: { [id]: [dam.storagePct] },
  } });
  const html = renderToStaticMarkup(<LocaleProvider locale="th"><DamDetail registered={damRegistryById.get(id)!} /></LocaleProvider>);
  expect(html).toContain('class="dam-downstream min-w-0 max-w-full overflow-x-auto"');
  expect(html.match(/width="100%" height="120" class="dam-chart w-full max-w-full"/g)).toHaveLength(2);
  expect(html.match(/>ดูเป็นตาราง<\/button>/g)).toHaveLength(1);
  expect(html.match(/กรมชลประทาน · <span/g)).toHaveLength(2); // Hero and shared chart attribution.
  const css = readFileSync(new URL("./dam-detail.css", import.meta.url), "utf8");
  expect(css).toMatch(/\.dam-sheet \{[^}]*grid-template-columns: minmax\(0, 1fr\)/);
  expect(css).toMatch(/\.dam-downstream \{[^}]*min-width: 0; max-width: 100%; overflow-x: auto/);
  expect(css).toMatch(/\.dam-chart \{[^}]*width: 100%; max-width: 100%; height: 120px/);
});
