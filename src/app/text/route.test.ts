import { beforeEach, expect, it, vi } from "vitest";
import { GET } from "./route";
import type { DamsPayload } from "@/lib/dams/client";

const { data, warnings } = vi.hoisted(() => ({ data: vi.fn(), warnings: vi.fn() }));
vi.mock("@/components/share/embed-data", () => ({ provinceEmbedData: data }));
vi.mock("@/app/api/tmd-warnings/route", () => ({ GET: warnings }));
beforeEach(() => {
  data.mockResolvedValue({ dams: null, flood: null });
  warnings.mockResolvedValue(Response.json({ error: "upstream", items: [] }));
});

it("returns plain cached HTML with emergency links and unavailable data rather than zero", async () => {
  const response = await GET(new Request("http://localhost/text"));
  const html = await response.text();
  expect(response.headers.get("Cache-Control")).toBe("public, s-maxage=600");
  expect(response.headers.get("Content-Type")).toBe("text/html; charset=utf-8");
  expect(Buffer.byteLength(html)).toBeLessThan(30_000);
  expect(html).not.toMatch(/<script\b|ปลอดภัย|\bsafe\b/i);
  expect(html.match(/ข้อมูลส่วนนี้ไม่พร้อมใช้งาน/g)).toHaveLength(3);
  for (const number of [1784, 1669, 191]) expect(html).toContain(`href="tel:${number}"`);
  expect(html).toContain('href="/"');
});

it("shows sourced English answers, 10 provinces and each dam's own date; bounds and escapes upstream text", async () => {
  data.mockResolvedValue({
    flood: { date: "2026-10-05", provinceCounts: Object.fromEntries(Array.from({ length: 15 }, (_, i) => [`province-${i}`,
      { flood: i + 1, recurringFlood: 0, dry: 1, water: 0, noData: 1, insufficientData: 1, sampled: 4 }])) },
    dams: { dataDate: "2026-10-06", dams: Array.from({ length: 35 }, (_, i) => ({ id: String(i),
      nameEn: '<script>alert("x")</script>', storagePct: 90, releaseCms: null, date: "2026-10-04" })) } as DamsPayload,
  });
  warnings.mockResolvedValue(Response.json({ items: Array.from({ length: 50 }, () => ({ title: "ฝน".repeat(1000), announcedAt: "2026-10-03" })) }));
  const response = await GET(new Request("http://localhost/text?lang=en"));
  const html = await response.text();
  expect(html).toContain('<html lang="en">');
  expect(html).toContain("Satellite water in 15 provinces");
  expect(html.match(/points; cloud/g)).toHaveLength(10);
  expect(html).toContain("50 warnings");
  expect(html).toContain("release — m³/s");
  for (const date of ["2026-10-05", "2026-10-04", "2026-10-03"]) expect(html).toContain(date);
  for (const source of ["NASA LANCE/GIBS VIIRS", "geoBoundaries ODbL", "app.rid.go.th", "data.tmd.go.th"]) expect(html).toContain(source);
  expect(html).not.toMatch(/<script\b|ปลอดภัย|\bsafe\b/i);
  expect(html).toContain("&lt;script&gt;");
  expect(Buffer.byteLength(html)).toBeLessThan(30_000);
});

it("distinguishes a successful empty warning report from an upstream failure", async () => {
  warnings.mockResolvedValue(Response.json({ items: [] }));
  const html = await (await GET(new Request("http://localhost/text?lang=en"))).text();
  expect(html).toContain("0 warnings");
  expect(html.match(/Data unavailable/g)).toHaveLength(2);
});
