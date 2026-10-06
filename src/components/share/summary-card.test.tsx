import { afterEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { translator } from "@/i18n/core";
import fixture from "@/lib/dams/fixture-rid.json";
import { parseRidDams } from "@/lib/dams/rid";
import { provinces } from "@/lib/provinces";
import { damSummaryCard, embedCode, lineShareUrl, provinceSummaryCard, summaryCardText } from "./summary-card";
import { EmbedCard } from "./embed-card";
import { renderSummaryImage } from "./render-summary-image";

const dam = { ...parseRidDams(fixture).dams.find((entry) => entry.id === "200101")!, date: "2026-10-05", releaseCms: 200 };
const province = provinces.find((entry) => entry.id === "phra-nakhon-si-ayutthaya")!;
const counts = { sampled: 100, flood: 5, recurringFlood: 2, dry: 33, water: 0, insufficientData: 50, noData: 10 };
const trend = { dates: ["2026-10-04"], release: { [dam.id]: [100] }, pct: {}, inflow: {} };

afterEach(() => vi.unstubAllGlobals());

it.each(["th", "en"] as const)("keeps source and each observation date in both %s cards, embeds and exported images", async (locale) => {
  const t = translator(locale);
  const cards = [damSummaryCard(dam, dam, trend, t), provinceSummaryCard(province, counts, "2026-10-03", [dam], t)];
  for (const card of cards) {
    const text = summaryCardText(card, `https://example.com${card.path}`, t);
    const html = renderToStaticMarkup(<EmbedCard card={card} t={t} />);
    const drawn: string[] = [];
    const ctx = { font: "", fillStyle: "", fillRect: vi.fn(), measureText: (line: string) => ({ width: line.length * 10 }), fillText: (line: string) => drawn.push(line) };
    const canvas = { width: 0, height: 0, getContext: () => ctx, toBlob: (done: (blob: Blob) => void) => done(new Blob(["png"])) };
    vi.stubGlobal("document", { fonts: { ready: Promise.resolve() }, body: {}, createElement: () => canvas });
    vi.stubGlobal("getComputedStyle", () => ({ fontFamily: "sans-serif" }));
    await renderSummaryImage(text, locale);
    const imageText = drawn.join(" ");
    for (const metric of card.metrics) {
      expect(metric.source).toBeTruthy();
      expect(metric.date).toMatch(locale === "en" ? /\d Oct/ : /\d ต\.ค\./);
      for (const content of [text, html, imageText]) {
        expect(content).toContain(metric.source);
        expect(content).toContain(metric.date);
      }
    }
    expect(text.endsWith(`https://example.com${card.path}\n${t("ฟ้าวันนี้")}`)).toBe(true);
    expect(html).toContain(`href="${card.path}"`);
    expect(html).not.toMatch(/<nav|<canvas|maplibre/i);
    expect(text).not.toMatch(/ปลอดภัย|\bsafe\b/i);
    if (locale === "en") expect(text + html).not.toMatch(/[ก-๙]/);
  }
  expect(cards[0].metrics[2].value).toContain("▲ 100");
  expect(cards[1].metrics[0].value).toContain("7");
  expect(cards[1].metrics[1].value).toBe("60%");
});

it("uses the highest reported upstream release and keeps that dam's own date", () => {
  const other = { ...dam, id: "200102", nameEn: "Sirikit", releaseCms: 300, date: "2026-10-04" };
  const unrelated = { ...dam, id: "unknown", releaseCms: 9999 };
  const card = provinceSummaryCard(province, counts, "2026-10-03", [dam, other, unrelated], translator("en"));
  expect(card.metrics[2]).toMatchObject({ value: "Sirikit · 300 m³/s", date: "4 Oct" });
});

it("does not replace missing observations or a missing exact previous day with zero", () => {
  const t = translator("en");
  const card = damSummaryCard(dam, { ...dam, releaseCms: null }, trend, t);
  expect(card.metrics[1].value).toBe("—");
  expect(card.metrics[2].value).toBe("—");
  expect(damSummaryCard(dam, dam, { ...trend, dates: ["2026-10-03"] }, t).metrics[2].value).toBe("—");
  expect(damSummaryCard(dam, { ...dam, releaseCms: 50 }, trend, t).metrics[2].value).toContain("▼ 50");
  const unknown = provinceSummaryCard(province, null, null, null, t);
  expect(unknown.metrics.every((metric) => metric.value.includes("—") && metric.source && metric.date === "Data date unknown")).toBe(true);
  const cloudy = provinceSummaryCard(province, { ...counts, insufficientData: 90 }, "2026-10-03", [], t);
  expect(cloudy.metrics[0].value).toContain("—");
  expect(cloudy.metrics[1].value).toBe("100%");
  expect(provinceSummaryCard(province, counts, null, [], t).metrics[0].value).toContain("—");
});

it("encodes the entire public page URL for the LINE social plugin", () => {
  const page = "https://example.com/province/ayutthaya?lang=en&name=อยุธยา#water";
  const link = lineShareUrl(page);
  expect(link).toBe(`https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(page)}`);
  expect(new URL(link).searchParams.get("url")).toBe(page);
});

it("produces copyable iframe HTML for the correct public embed path and escapes titles", () => {
  expect(embedCode("https://example.com/dam/200101?lens=dams#water", 'Dam "A" <B>')).toBe('<iframe src="https://example.com/embed/dam/200101" title="Dam &quot;A&quot; &lt;B&gt;" width="100%" height="420" loading="lazy" style="border:0"></iframe>');
});
