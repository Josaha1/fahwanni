import { describe, expect, it } from "vitest";
import { interpolate, intlLocale, thai, translator } from "./core";
import { en } from "./en";

describe("translator", () => {
  it("returns Thai source text and its English translation", () => {
    expect(translator("th")("ภาษา")).toBe("ภาษา");
    expect(translator("en")("ภาษา")).toBe("Language");
  });

  it("falls back to the Thai text when an entry is missing", () => {
    expect(translator("en")("ข้อความที่ยังไม่มีคำแปล")).toBe("ข้อความที่ยังไม่มีคำแปล");
  });

  it("fills placeholders in either language", () => {
    expect(thai("ให้ยาครบ {n} วันติด", { n: 3 })).toBe("ให้ยาครบ 3 วันติด");
    expect(interpolate("{a} and {b}", { a: 1 })).toBe("1 and {b}");
  });

  it("maps locales to Intl tags", () => {
    expect(intlLocale("th")).toBe("th-TH");
    expect(intlLocale("en")).toBe("en-GB");
  });
});

describe("English dictionary", () => {
  it("keeps every placeholder of the Thai key", () => {
    const names = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
    const broken = Object.entries(en).filter(([th, eng]) => names(th) !== names(eng)).map(([th]) => th);
    expect(broken).toEqual([]);
  });

  it("has no empty translations", () => {
    expect(Object.entries(en).filter(([, v]) => !v.trim()).map(([k]) => k)).toEqual([]);
  });
});

describe("plurals", () => {
  it("picks singular or plural English forms", () => {
    expect(interpolate("{n} {n:day|days} ago", { n: 1 })).toBe("1 day ago");
    expect(interpolate("{n} {n:day|days} ago", { n: 3 })).toBe("3 days ago");
  });
});
