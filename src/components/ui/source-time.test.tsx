import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LocaleProvider } from "@/i18n/client";
import { SourceTime } from "./source-time";

const nowMs = Date.parse("2026-10-04T16:00:00+07:00");
const render = (locale: "th" | "en", props: React.ComponentProps<typeof SourceTime>) =>
  renderToStaticMarkup(<LocaleProvider locale={locale}><SourceTime nowMs={nowMs} {...props} /></LocaleProvider>);

describe("source time", () => {
  it("shows a short report date and translated agency", () => {
    expect(render("th", { source: "กรมชลประทาน", date: "2026-10-04", kind: "daily" })).toContain("กรมชลประทาน · <span>ข้อมูลวันที่ 4 ต.ค.");
    expect(render("en", { source: "กรมชลประทาน", date: "2026-10-04", kind: "daily" })).toContain("Royal Irrigation Department");
  });
  it("uses Bangkok today and clock time for a TMD timestamp without an offset", () => {
    expect(render("th", { source: "TMD", time: "2026-10-04 14:00:00", kind: "rain24h" })).toContain("14:00 วันนี้");
    expect(render("en", { source: "TMD", time: "2026-10-04T14:00", kind: "rain24h" })).toContain("14:00 today");
  });
  it.each(["daily", "rain24h", "satellite"] as const)("shows amber old data for %s", (kind) => {
    const thai = render("th", { source: "NASA", date: "2026-09-29", kind });
    expect(thai).toContain("text-amber-600");
    expect(thai).toContain("ข้อมูลเก่า (29 ก.ย.)");
    expect(render("en", { source: "NASA", date: "2026-09-29", kind })).toContain("Old data");
  });
  it("labels yesterday without amber", () => {
    const html = render("th", { source: "RID", date: "2026-10-03", kind: "daily" });
    expect(html).toContain("ข้อมูลเมื่อวาน");
    expect(html).not.toContain("text-amber");
  });
  it("labels old model dates as models and monthly observations with the month", () => {
    const model = render("th", { source: "GloFAS", date: "2020-01-01", kind: "daily", model: true });
    expect(model).toContain('class="map-water-badge">แบบจำลอง');
    expect(model).not.toContain("ข้อมูลเก่า");
    const monthly = render("th", { source: "HII", date: "2026-07", kind: "monthly" });
    expect(monthly).toContain("ข้อมูลเดือน ก.ค. 2569");
    expect(monthly).not.toContain("ข้อมูลเก่า");
  });
  it("does not invent a date for missing or malformed reports", () => {
    expect(render("th", { source: "RID", kind: "daily" })).toContain("ไม่ทราบวันที่ข้อมูล");
    expect(render("en", { source: "RID", date: "invalid", kind: "daily" })).toContain("Data date unknown");
  });
});
