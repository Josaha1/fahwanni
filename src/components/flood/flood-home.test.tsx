import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LocaleProvider } from "@/i18n/client";
import { FloodHome } from "./flood-home";
import type { Load } from "@/hooks/use-water-source";

const { sources } = vi.hoisted(() => ({ sources: new Map<string, Load<unknown>>() }));
vi.mock("@/hooks/use-water-source", () => ({ useWaterSource: (url: string) => sources.get(url.split("?")[0] + (url.includes("lat=") ? "-near" : "")) ?? { status: "error", data: null } }));
vi.mock("@/hooks/use-favourites", () => ({ useLastPlace: () => ({ place: { id: "bangkok", name: "กรุงเทพมหานคร", admin: "Bangkok", lat: 13.7, lon: 100.5, source: "province" } }) }));

const render = (locale: "th" | "en" = "th") => renderToStaticMarkup(<LocaleProvider locale={locale}><FloodHome /></LocaleProvider>);
const ready = (url: string, data: unknown) => sources.set(url, { status: "ready", data, loadedAt: "2026-10-05T07:00:00+07:00" });
beforeEach(() => sources.clear());

describe("FloodHome", () => {
  it("retains warnings, four nearby rows, the map link and footer when every source fails", () => {
    const html = render();
    for (const label of ["ข้อมูลประกาศเตือนภัยไม่พร้อมใช้งาน", "ดาวเทียมน้ำท่วมใกล้บ้าน", "หมู่บ้านเสี่ยง ปภ. ใกล้คุณ", "ฝน 24 ชม. สถานีใกล้สุด (TMD)", "เขื่อนต้นน้ำระบาย (เขื่อนใกล้สุด)", "ดูบนแผนที่", "ข้อมูลล่าสุด", "เบอร์ฉุกเฉิน"]) expect(html).toContain(label);
    expect(html).not.toContain("ปลอดภัย");
    expect(html.indexOf("ดูบนแผนที่")).toBeLessThan(html.indexOf("ทั้งประเทศ"));
    expect(html).toContain('href="tel:1784"');
  });
  it.each([
    ["flood", "ดาวเทียมเห็นน้ำท่วมในรัศมี 30 กม."],
    ["not-seen", "ดาวเทียมไม่พบน้ำท่วมในรัศมี 30 กม."],
    ["cloud-or-no-data", "เมฆบัง/ข้อมูลไม่พอ"],
  ])("renders the satellite verdict %s with its observation date", (verdict, label) => {
    ready("/api/flood-now-near", { date: "2026-10-01", nearMe: { verdict } });
    const html = render();
    expect(html).toContain(label);
    expect(html).toContain("NASA VIIRS");
    expect(html).toContain("text-amber-600");
    expect(html).toContain("ข้อมูลส่วนนี้ไม่พร้อมใช้งาน");
  });
  it("uses all stations, counts only villages within ten km, and keeps missing dam comparisons explicit", () => {
    ready("/api/rain-risk", { observedAt: "2026-10-05T07:00:00+07:00", stations: [], all: [{ id: "zero", nameTh: "สถานีใกล้", nameEn: "Nearby station", lat: 13.7, lon: 100.5, rainMm: 0 }] });
    ready("/api/flood-risk", { points: [{ lat: 13.7, lon: 100.5 }, { lat: 14.1, lon: 100.5 }] });
    ready("/api/dams", { dams: [{ id: "dam", nameTh: "เขื่อนใกล้", nameEn: "Nearby dam", lat: 13.7, lon: 100.5, date: "2026-10-05", releaseCms: 12 }] });
    const html = render();
    expect(html).toContain("สถานีใกล้ · 0 มม. · 0 กม.");
    expect(html).toContain("1 หมู่บ้าน · ความเสี่ยงจากประวัติ");
    expect(html).toContain("ยังเทียบเมื่อวานไม่ได้");
    const english = render("en");
    expect(english).toContain("Nearby station · 0 mm · 0 km");
    expect(english).toContain("1 villages · historical risk");
    expect(english).toContain("Previous day unavailable");
  });
  it("shows national totals with English region names and defaults the province to the nearest one", () => {
    const counts = { flood: 2, recurringFlood: 1, dry: 0, water: 0, insufficientData: 0, noData: 0, sampled: 3 };
    ready("/api/flood-now", { date: "2026-10-05", regionCounts: { north: counts }, provinceCounts: {} });
    ready("/api/tmd-warnings", { items: [{ title: "Warning", description: "ภาคเหนือ", announcedAt: "2026-10-05T07:00:00+07:00" }] });
    ready("/api/flood-events", { fetchedAt: "2026-10-05T07:00:00+07:00", days: 90, sources: ["GDACS"], items: [] });
    const english = render("en");
    expect(english).toContain("North: 3 sampling points");
    expect(english).toContain("1 warnings");
    expect(english).toContain("0 provinces named in reports");
    expect(english).toContain('value="bangkok" selected=""');
    expect(english).toContain("<p>North: Warning</p>");
  });
});
