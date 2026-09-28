import { describe, expect, it } from "vitest";
import { wrapText } from "./wrap-text";

const byChars = (s: string) => [...s].length;

describe("wrapText", () => {
  it("keeps short text on one line", () => {
    expect(wrapText("ฝนตก", 20, byChars)).toEqual(["ฝนตก"]);
  });

  it("breaks Thai at word boundaries, not mid-word", () => {
    const lines = wrapText("พกร่มด้วยฝนมีโอกาสตกในหกชั่วโมงข้างหน้า", 12, byChars);
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) expect(byChars(line)).toBeLessThanOrEqual(12);
    expect(lines.join("")).toBe("พกร่มด้วยฝนมีโอกาสตกในหกชั่วโมงข้างหน้า");
    // "ชั่วโมง" must not be split across lines.
    expect(lines.some((line) => line.includes("ชั่วโมง"))).toBe(true);
  });

  it("wraps English at spaces", () => {
    expect(wrapText("Take an umbrella today", 10, byChars, "en")).toEqual(["Take an", "umbrella", "today"]);
  });

  it("keeps explicit line breaks and splits an over-long single word", () => {
    expect(wrapText("a\nb", 10, byChars, "en")).toEqual(["a", "b"]);
    expect(wrapText("abcdefghij", 4, byChars, "en")).toEqual(["abcd", "efgh", "ij"]);
  });
});
