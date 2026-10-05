import { afterEach, describe, expect, it, vi } from "vitest";
import { translator } from "@/i18n/core";
import { buildFloodShareText } from "@/lib/share";
import { renderSummaryImage } from "./render-summary-image";

afterEach(() => vi.unstubAllGlobals());

describe("flood share image", () => {
  it.each(["th", "en"] as const)("fits every summary line and source inside the %s card", async (locale) => {
    const drawn: { text: string; y: number }[] = [];
    const ctx = { font: "", fillStyle: "", fillRect: vi.fn(),
      measureText: (text: string) => ({ width: Array.from(text).length * 28 }),
      fillText: (text: string, _x: number, y: number) => drawn.push({ text, y }) };
    const blob = new Blob(["png"], { type: "image/png" });
    const canvas = { width: 0, height: 0, getContext: () => ctx, toBlob: (done: (value: Blob) => void) => done(blob) };
    vi.stubGlobal("document", { fonts: { ready: Promise.resolve() }, body: {}, createElement: () => canvas });
    vi.stubGlobal("getComputedStyle", () => ({ fontFamily: "sans-serif" }));
    const text = buildFloodShareText({ eventProvinces: 77, warnings: 5, satellitePoints: 3000,
      eventsAt: "2026-10-05T00:00:00Z", warningsAt: "2026-10-05T01:00:00Z", satelliteDate: "2026-10-04" }, translator(locale));
    expect(await renderSummaryImage(text, locale)).toBe(blob);
    expect(canvas.width).toBe(1080);
    expect(canvas.height).toBeGreaterThanOrEqual(1350);
    if (locale === "en") expect(canvas.height).toBeGreaterThan(1350);
    for (const line of drawn) {
      expect(ctx.measureText(line.text).width).toBeLessThanOrEqual(920);
      expect(line.y).toBeLessThan(canvas.height - 40);
    }
    const rendered = drawn.map((line) => line.text).join(" ");
    for (const source of ["GLIDE", "GDACS", "TMD", "NASA", "VIIRS", "1784"]) expect(rendered).toContain(source);
    expect(rendered).toContain(locale === "th" ? "จุดตรวจ" : "Sampling");
  });
});
