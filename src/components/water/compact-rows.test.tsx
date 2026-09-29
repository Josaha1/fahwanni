import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LocaleProvider } from "@/i18n/client";
import fixture from "@/lib/dams/fixture-rid.json";
import { parseRidDams } from "@/lib/dams/rid";
import { DamRowHeader, damDetailsId, damRowPercentLabel } from "./dam-row";
import { RiverDetails, RiverRowHeader, riverDetailsId, riverRowValueLabel, type RiverRow } from "./river-details";

const point: RiverRow = {
  id: "test-river", nameTh: "แม่น้ำทดสอบ", nameEn: "Test River", lat: 13, lon: 100, downstreamOfDam: null,
  summary: { today: { date: "2026-09-29", value: 1234, status: "high" }, trend: "rising", peak: null,
    rare: null, value2554Today: 900, days: [] },
};
const dam = parseRidDams(fixture).dams[0];
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

  it("formats dam storage and renders expanded flow, date and map link", () => {
    expect(damRowPercentLabel(91.47, "en")).toBe("91.5%");
    const html = render("en", <DamRowHeader dam={dam} km={4} expanded onToggle={() => {}} />);
    expect(html).toContain(`aria-controls="${damDetailsId(dam.id)}"`);
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain("4 km");
    expect(html).toContain("Flow through the dam (release)");
    expect(html).toContain("Inflow");
    expect(html).toContain("Data from");
    expect(html).toContain(`/map?mode=water&amp;dam=${dam.id}`);
    const collapsed = render("th", <DamRowHeader dam={dam} expanded={false} onToggle={() => {}} />);
    expect(collapsed).toContain(`id="${damDetailsId(dam.id)}" hidden=""`);
  });
});
