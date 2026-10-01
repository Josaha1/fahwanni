import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LocaleProvider } from "@/i18n/client";
import { FloodEventList } from "./flood-events";
import type { FloodEvent } from "@/lib/water/flood-events";

const event = (id: string, extra: Partial<FloodEvent> = {}): FloodEvent => ({ id, source: "glide", type: "flood", date: "2026-09-27", endDate: null,
  alert: null, lat: 13.75, lon: 100.5, place: "Bangkok", summary: "Heavy rain flooded Bangkok.", url: "https://example.org", glide: null, ...extra });

describe("flood event list", () => {
  it("shows type, place, date and source, labels the English text and limits to three", () => {
    const html = renderToStaticMarkup(<LocaleProvider locale="th"><FloodEventList payload={{ fetchedAt: "", days: 90, sources: ["GLIDE"],
      items: [event("a"), event("b", { source: "gdacs", alert: "Red" }), event("c"), event("d")] }} /></LocaleProvider>);
    expect(html).toContain("น้ำท่วม · Bangkok");
    expect(html).toContain("ระดับเตือน GDACS: แดง");
    expect(html).toContain('lang="en"');
    expect(html).toContain("ดูทั้งหมด (4)");
    expect(html).toContain("ไม่ใช่ประกาศทางการของไทย");
    expect(html.match(/<article/g)).toHaveLength(3);
  });
});
