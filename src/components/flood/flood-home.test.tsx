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
  it("retains warnings, four nearby visuals, the map link and footer when every source fails", () => {
    const html = render();
    for (const label of ["ข้อมูลประกาศเตือนภัยไม่พร้อมใช้งาน", "ดาวเทียมน้ำท่วมใกล้บ้าน", "หมู่บ้านเสี่ยง ปภ. ใกล้คุณ", "ฝน 24 ชม. สถานีใกล้สุด (TMD)", "เขื่อนต้นน้ำระบาย (เขื่อนใกล้สุด)", "ดูบนแผนที่", "ข้อมูลล่าสุด", "เบอร์ฉุกเฉิน"]) expect(html).toContain(label);
    expect(html).not.toContain("ปลอดภัย");
    expect(html.indexOf("ดูบนแผนที่")).toBeLessThan(html.indexOf("ทั้งประเทศ"));
    expect(html).toContain('href="tel:1784"');
  });
  it.each([
    ["flood", "ดาวเทียม: น้ำท่วม 1 จุดตรวจ"],
    ["not-seen", "ดาวเทียม: น้ำท่วม 0 จุดตรวจ"],
    ["cloud-or-no-data", "ดาวเทียม: ไม่มีข้อมูลที่ใช้ได้"],
  ])("renders the satellite verdict %s with its observation date", (verdict, label) => {
    ready("/api/flood-now-near", { date: "2026-10-01", nearMe: { verdict, counts: { flood: verdict === "flood" ? 1 : 0, recurringFlood: 0, dry: 0,
      water: verdict === "not-seen" ? 1 : 0, insufficientData: verdict === "cloud-or-no-data" ? 1 : 0, noData: 0, sampled: 1 }, samples: [{ lat: 13.7, lon: 100.5, kind: verdict === "flood" ? "flood" : verdict === "not-seen" ? "water" : "insufficient-data" }] } });
    const html = render();
    expect(html).toContain(label);
    expect(html).toContain("NASA VIIRS");
    expect(html).toContain("text-amber-600");
    expect(html).toContain("ข้อมูลส่วนนี้ไม่พร้อมใช้งาน");
  });
  it("uses full API counts for the nearby caption, aria and state instead of display samples", () => {
    ready("/api/flood-now-near", { date: "2026-10-05", nearMe: { verdict: "flood",
      counts: { flood: 7, recurringFlood: 2, dry: 10, water: 0, insufficientData: 350, noData: 6, sampled: 375 },
      samples: Array.from({ length: 7 }, () => ({ lat: 13.7, lon: 100.5, kind: "flood" })) } });
    const html = render();
    const summary = "ดาวเทียม: น้ำท่วม 9 จุดตรวจในรัศมี 30 กม. · เมฆบัง/ข้อมูลไม่พอ 356 จุดตรวจ · จุดตรวจ ไม่ใช่พื้นที่";
    expect(html).toContain(`aria-label="${summary}"`);
    expect(html).toContain(`title="${summary}">${summary}</p>`);
    expect(html).toContain('&quot;flood&quot;:9');
    expect(html).toContain('&quot;insufficient&quot;:356');
    expect(html).not.toContain("น้ำท่วม 7 จุดตรวจ");
  });
  it("uses all stations, counts only villages within ten km, and keeps missing dam comparisons explicit", () => {
    ready("/api/rain-risk", { observedAt: "2026-10-05T07:00:00+07:00", stations: [], all: [{ id: "zero", nameTh: "สถานีใกล้", nameEn: "Nearby station", lat: 13.7, lon: 100.5, rainMm: 0 }] });
    ready("/api/flood-risk", { points: [{ lat: 13.7, lon: 100.5 }, { lat: 14.1, lon: 100.5 }] });
    ready("/api/dams", { dams: [{ id: "dam", nameTh: "เขื่อนใกล้", nameEn: "Nearby dam", lat: 13.7, lon: 100.5, date: "2026-10-05", releaseCms: 12 }] });
    const html = render();
    expect(html).toContain("สถานีใกล้ · ฝน 0 มม.");
    expect(html).toContain("1 หมู่บ้าน · ความเสี่ยงจากประวัติ");
    expect(html).toContain("ยังเทียบเมื่อวานไม่ได้");
    const english = render("en");
    expect(english).toContain("Nearby station · Rain 0 mm");
    expect(english).toContain("1 villages · historical risk");
    expect(english).toContain("Previous day unavailable");
  });
  it("shows national totals with map warnings and defaults the province to the nearest one", () => {
    const counts = { flood: 2, recurringFlood: 1, dry: 0, water: 0, insufficientData: 0, noData: 0, sampled: 3 };
    ready("/api/flood-now", { date: "2026-10-05", regionCounts: { north: counts }, provinceCounts: { "chiang-mai": counts } });
    ready("/api/tmd-warnings", { items: [{ title: "Warning", description: "ภาคเหนือ", announcedAt: "2026-10-05T07:00:00+07:00" }] });
    ready("/api/flood-events", { fetchedAt: "2026-10-05T07:00:00+07:00", days: 90, sources: ["GDACS"], items: [] });
    const english = render("en");
    expect(english).toContain("3 sampling points");
    expect(english).toContain("1 regions with warnings");
    expect(english).toContain("0 provinces named in reports");
    expect(english).toContain('value="bangkok" selected=""');
    expect(english).toContain('data-warned-region="north"');
    expect(english.match(/data-province=/g)).toHaveLength(77);
    expect(english).toContain("<details><summary");
    expect(english).toContain("View list");
  });
});
