import { expect, it } from "vitest";
import type { Dam } from "./dams/types";
import { DAM_CSV_SOURCE, PROVINCE_CSV_SOURCE, damsCsv, provincesCsv, toCsv } from "./csv";

it("writes UTF-8 BOM, CRLF and escaped commas, quotes and newlines", () => {
  expect(toCsv(["ชื่อ", "แหล่ง"], [['เขื่อน, "หนึ่ง"\nสอง', "RID"]]))
    .toBe('\uFEFFชื่อ,แหล่ง\r\n"เขื่อน, ""หนึ่ง""\nสอง",RID\r\n');
});

it("leaves missing/non-finite values blank while preserving reported zero", () => {
  expect(toCsv(["a", "b", "c", "d", "e"], [[null, undefined, NaN, Infinity, 0]]))
    .toBe("\uFEFFa,b,c,d,e\r\n,,,,0\r\n");
});

it("includes the dam source column and original per-dam report dates", () => {
  const csv = damsCsv([{ id: "1", nameTh: "หนึ่ง", province: { th: "ตาก" }, storagePct: 80,
    storageMcm: 100, inflowCms: 0, releaseCms: null, date: "2026-10-05" }] as Dam[]);
  expect(csv.split("\r\n")[0]).toBe("\uFEFFid,ชื่อ,จังหวัด,%ความจุ,ล้าน ม³,ไหลเข้า (ลบ.ม./วิ),ระบาย (ลบ.ม./วิ),วันที่รายงาน,แหล่ง");
  expect(csv).toContain(`1,หนึ่ง,ตาก,80,100,0,,2026-10-05,${DAM_CSV_SOURCE}`);
});

it("exports all provinces with source, sampled points and cloud percentage, leaving unreported water blank", () => {
  const csv = provincesCsv({ bangkok: { flood: 2, recurringFlood: 3, dry: 5, water: 0, noData: 5, insufficientData: 5, sampled: 20 },
    tak: { flood: 0, recurringFlood: 0, dry: 0, water: 0, noData: 10, insufficientData: 0, sampled: 10 } }, "2026-10-06");
  expect(csv.split("\r\n")).toHaveLength(79);
  expect(csv.split("\r\n")[0]).toBe("\uFEFFid,ชื่อ,จุดน้ำดาวเทียม,จุดตรวจ,เมฆ%,วันที่ภาพ,แหล่ง");
  expect(csv).toContain(`bangkok,กรุงเทพมหานคร,5,20,50,2026-10-06,${PROVINCE_CSV_SOURCE}`);
  expect(csv).toContain(`tak,ตาก,,10,100,2026-10-06,${PROVINCE_CSV_SOURCE}`);
  expect(csv).toContain(`chiang-mai,เชียงใหม่,,,,2026-10-06,${PROVINCE_CSV_SOURCE}`);
});
