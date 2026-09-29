import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseTmdWarnings, visibleWarnings, warningKey } from "./tmd";

const fixture = (name: string) => readFileSync(new URL(`./storms/fixtures/${name}`, import.meta.url), "utf8");

describe("parseTmdWarnings", () => {
  it("ignores the header when the real feed has no warnings", () => {
    expect(parseTmdWarnings(fixture("tmd-warnings.xml"))).toEqual({ items: [] });
  });

  it("reads two warning items and optional fields", () => {
    expect(parseTmdWarnings(fixture("tmd-warnings-two.xml"))).toEqual({ items: [
      { title: "ประกาศพายุลูกแรก", description: "ระวังฝนหนัก & ลมแรง", announcedAt: "2026-09-28 13:00:00", url: "https://www.tmd.go.th/warning/1" },
      { title: "ประกาศฉบับที่ 2", description: "คลื่นสูง 2–3 เมตร" },
    ] });
  });

  it.each(["", "broken", "<Warnings><Warning><title>Bad</title></Warnings>", "<Warnings/>"])("treats empty or garbled XML as no warnings", (xml) => {
    expect(parseTmdWarnings(xml)).toEqual({ items: [] });
  });
});

describe("water-mode warning visibility", () => {
  const items = [
    { title: "ฝนหนัก", description: "ระวังน้ำป่า", announcedAt: "2026-09-28 13:00:00" },
    { title: "น้ำท่วมฉับพลัน", description: "ติดตามประกาศ" },
  ];

  it("keys warnings by announced time and title", () => {
    expect(warningKey(items[0])).toBe("2026-09-28 13:00:00|ฝนหนัก");
    expect(warningKey(items[1])).toBe("|น้ำท่วมฉับพลัน");
  });

  it("keeps only warnings not dismissed in this session", () => {
    expect(visibleWarnings(items, [warningKey(items[0])])).toEqual([items[1]]);
    expect(visibleWarnings(items, [])).toEqual(items);
  });
});
