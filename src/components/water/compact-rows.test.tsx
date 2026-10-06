import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LocaleProvider } from "@/i18n/client";
import { RiverDetails, RiverRowHeader, riverDetailsId, riverRowValueLabel, type RiverRow } from "./river-details";

const point: RiverRow = {
  id: "test-river", nameTh: "แม่น้ำทดสอบ", nameEn: "Test River", lat: 13, lon: 100, downstreamOfDam: null,
  summary: { today: { date: "2026-09-29", value: 1234, status: "high" }, trend: "rising", peak: null,
    rare: null, value2554Today: 900, days: [] },
};
const render = (locale: "th" | "en", child: React.ReactNode) => renderToStaticMarkup(<LocaleProvider locale={locale}>{child}</LocaleProvider>);

describe("compact water rows", () => {
  it("formats the river value for the visible row and spoken unit in both languages", () => {
    expect(riverRowValueLabel(1234, "th")).toBe("1,234 ลบ.ม./วินาที");
    expect(riverRowValueLabel(1234, "en")).toBe("1,234 m³/s");
    const html = render("en", <RiverRowHeader point={point} km={12} expanded={false} onToggle={() => {}} onToggleWatch={() => {}} />);
    expect(html).toContain(`aria-controls="${riverDetailsId(point.id)}"`);
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-label="1,234 m³/s"');
    expect(html).toContain("Test River");
    expect(html).toContain("Above normal");
    expect(html).toContain("12 km");
    expect(html).toContain("Watch this river point");
  });

  it("keeps the body available to the toggle and gates disclaimers", () => {
    const body = render("th", <RiverDetails point={point} expanded={false} />);
    expect(body).toContain(`id="${riverDetailsId(point.id)}" hidden=""`);
    expect(body).not.toContain("ตัวเลขนี้อย่างเดียวไม่ได้บอกว่าจะท่วม");
    expect(body).not.toContain("ประมาณการจากแบบจำลอง GloFAS");
    const map = render("en", <RiverDetails point={point} mapCard showDisclaimers />);
    expect(map).toContain("This number alone does not tell whether flooding will occur");
    expect(map).toContain("GloFAS model estimate at 5 km resolution");
  });

  it("shows a dated observed range only when a gauge exists, in both languages", () => {
    const withGauge: RiverRow = { ...point, gauge: { code: "011", name: "River, North", lat: 13, lon: 100, km: 1,
      month: "2026-07", levelMsl: { min: 1, mean: 2, max: 3 }, bankMsl: 5,
      days: { from: "2026-07-01", to: "2026-07-31", count: 31 } } };
    expect(render("th", <RiverDetails point={point} />)).not.toContain("ระดับน้ำที่สถานีจริง");
    const thai = render("th", <RiverDetails point={withGauge} />);
    expect(thai).toContain("ระดับน้ำที่สถานีจริง River, North เดือน ก.ค. 2569");
    expect(thai).toContain("(ตลิ่ง 5 ม.รทก.)");
    expect(render("en", <RiverDetails point={withGauge} />)).toContain("Observed water level at River, North, Jul 2026");
    expect(render("en", <RiverDetails point={{ ...withGauge, gauge: { ...withGauge.gauge!, bankMsl: null } }} />)).not.toContain("bank 5");
  });

  it("shows an observed point as measured dam release with no model status", () => {
    const observed: RiverRow = {
      id: "maeklong-ratchaburi", nameTh: "แม่กลอง โพธาราม", nameEn: "Mae Klong River at Photharam", lat: 13.6, lon: 99.8,
      downstreamOfDam: null, kind: "observed", summary: null, releaseDams: ["200401", "200402"],
      gauge: { code: "RAJ001", name: "โพธาราม", lat: 13.6, lon: 99.8, km: 0, month: "2026-07",
        levelMsl: { min: 0.05, mean: 0.25, max: 0.64 }, bankMsl: null, days: { from: "2026-07-01", to: "2026-07-31", count: 31 } },
      release: { today: { date: "2026-09-29", totalCms: 32.5, missing: ["200402"] }, trend: null,
        dams: [{ damId: "200401", releaseCms: 32.5, date: "2026-09-29" }, { damId: "200402", releaseCms: null, date: null }],
        days: [{ date: "2026-09-28", totalCms: 30 }, { date: "2026-09-29", totalCms: 32.5 }] },
    };
    const header = render("th", <RiverRowHeader point={observed} expanded={false} onToggle={() => {}} />);
    expect(header).toContain("ระบายจากเขื่อน 33 ลบ.ม./วินาที");
    expect(header).toContain("วัดจริง");
    expect(header).not.toMatch(/แบบจำลอง|สูงกว่าปกติ/);
    const details = render("th", <RiverDetails point={observed} />);
    expect(details).toContain("ไม่ใช่ปริมาณน้ำที่ไหลผ่านโพธาราม");
    expect(details).toContain("ไม่รายงานวันนี้");
    expect(details).toContain("ระดับน้ำที่สถานีจริง โพธาราม");
    expect(details).not.toContain("ข้อมูลจุดนี้ไม่พร้อมใช้งาน");
    expect(render("en", <RiverRowHeader point={observed} expanded={false} onToggle={() => {}} />)).toContain("Measured");
  });
});
