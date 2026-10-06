import type { Dam } from "@/lib/dams/types";
import type { PixelCounts } from "@/lib/flood/viirs";
import { provinces } from "@/lib/provinces";
import { cloudPercent, waterPoints } from "@/components/sheet/home-data";

type Cell = string | number | null | undefined;
export const DAM_CSV_SOURCE = "กรมชลประทาน (RID) app.rid.go.th";
export const PROVINCE_CSV_SOURCE = "NASA LANCE/GIBS VIIRS; geoBoundaries ODbL";

export function toCsv(headers: readonly string[], rows: readonly (readonly Cell[])[]): string {
  const escape = (value: Cell) => {
    const text = value == null || (typeof value === "number" && !Number.isFinite(value)) ? "" : String(value);
    return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  return "\uFEFF" + [headers, ...rows].map((row) => row.map(escape).join(",")).join("\r\n") + "\r\n";
}

export function damsCsv(dams: readonly Dam[]): string {
  return toCsv(["id", "ชื่อ", "จังหวัด", "%ความจุ", "ล้าน ม³", "ไหลเข้า (ลบ.ม./วิ)", "ระบาย (ลบ.ม./วิ)", "วันที่รายงาน", "แหล่ง"],
    dams.map((dam) => [dam.id, dam.nameTh, dam.province?.th, dam.storagePct, dam.storageMcm, dam.inflowCms, dam.releaseCms, dam.date, DAM_CSV_SOURCE]));
}

export function provincesCsv(counts: Record<string, PixelCounts>, date: string): string {
  return toCsv(["id", "ชื่อ", "จุดน้ำดาวเทียม", "จุดตรวจ", "เมฆ%", "วันที่ภาพ", "แหล่ง"],
    provinces.map((province) => {
      const observed = counts[province.id];
      // No usable observations cannot establish a zero-water result.
      const hasReport = observed && observed.sampled > observed.insufficientData + observed.noData;
      return [province.id, province.th, hasReport ? waterPoints(observed) : null, observed?.sampled,
        cloudPercent(observed), date, PROVINCE_CSV_SOURCE];
    }));
}

export function downloadCsv(csv: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Give the browser time to start reading the Blob before releasing it.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
