import type { PixelCounts } from "@/lib/flood/viirs";
import type { Dam } from "@/lib/dams/types";

export const number = (value: number | null | undefined) => value == null || !Number.isFinite(value)
  ? "—" : new Intl.NumberFormat("th-TH", { maximumFractionDigits: 1 }).format(value);
export const waterPoints = (counts: PixelCounts) => counts.flood + counts.recurringFlood;
export const cloudPercent = (counts: PixelCounts | null | undefined) => counts && counts.sampled > 0
  ? 100 * (counts.insufficientData + counts.noData) / counts.sampled : null;

export function damClipboard(dams: Dam[]): string {
  return ["เขื่อน\t%\tล้าน ม³\tเข้า (ม³/วินาที)\tระบาย (ม³/วินาที)\tแหล่ง\tวันที่",
    ...dams.map((dam) => [dam.nameTh, number(dam.storagePct), number(dam.storageMcm), number(dam.inflowCms), number(dam.releaseCms), "กรมชลประทาน", dam.date].join("\t")),
    "— = ไม่รายงาน", "ที่มา: https://app.rid.go.th/reservoir/"].join("\n");
}
