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
  expect(html).toContain("ปีที่แล้ว (วันเดียวกัน): 88.7%");
  expect(html).toContain("ปี 2554 (วันเดียวกัน): 97.2%");
  expect(html).toContain(`กรมชลประทาน · ${lastYearLabel}`);
  expect(html).toContain(`กรมชลประทาน · ${year2554Label}`);
  expect(html).not.toContain("ข้อมูลเก่า");
  expect(html).not.toContain("text-amber");
  expect(html).not.toContain("2569");
});

it("keeps absent historical dates unknown instead of substituting today's date", () => {
  sources.set("/api/dams-history", { status: "ready", data: { dataDate: "2026-10-05", lastYear: null, year2554: null } });
  const html = comparison();
  expect(html).toContain("ไม่พบข้อมูลในวันที่เปรียบเทียบ");
  expect(html).toContain("กรมชลประทาน · ไม่ทราบวันที่ข้อมูล");
  expect(html).not.toContain("ข้อมูลเก่า");
  expect(html).not.toContain("2569");
});
