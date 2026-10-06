import type { DamsPayload } from "@/lib/dams/client";
import type { PixelCounts } from "@/lib/flood/viirs";
import type { TmdWarnings } from "@/lib/tmd";
import type { Locale } from "@/i18n/core";
import { provinces } from "@/lib/provinces";
import { cloudPercent, waterPoints } from "@/components/sheet/home-data";
import { PROVINCE_CSV_SOURCE } from "./csv";

export type TextPageData = {
  flood: { provinceCounts: Record<string, PixelCounts>; date: string } | null;
  dams: DamsPayload | null;
  warnings: TmdWarnings | null;
  checkedAt: string;
};

// Bound upstream text before escaping so the 2G response stays small even for long bulletins.
const html = (value: string | null | undefined, limit = 100) => (value ?? "—").slice(0, limit)
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
const number = (value: number | null | undefined) => value == null || !Number.isFinite(value) ? "—" : String(Math.round(value * 10) / 10);

export function textPage(data: TextPageData, locale: Locale): string {
  const en = locale === "en";
  const unavailable = en ? "Data unavailable" : "ข้อมูลส่วนนี้ไม่พร้อมใช้งาน";
  const date = (value?: string | null) => `${en ? "Report / image date" : "วันที่รายงาน / ภาพ"}: ${html(value, 40)}`;
  const checked = `${en ? "Checked" : "ตรวจข้อมูลเมื่อ"}: ${html(data.checkedAt, 40)}`;
  const flooded = Object.entries(data.flood?.provinceCounts ?? {}).filter(([, counts]) => waterPoints(counts) > 0)
    .sort((a, b) => waterPoints(b[1]) - waterPoints(a[1]) || a[0].localeCompare(b[0]));
  const water = data.flood ? `<p>${en ? "Satellite water in" : "ดาวเทียมพบน้ำ"} ${flooded.length} ${en ? "provinces" : "จังหวัด"}</p><ol>${flooded.slice(0, 10).map(([id, counts]) => {
    const province = provinces.find((entry) => entry.id === id);
    return `<li>${html(en ? province?.en ?? id : province?.th ?? id)}: ${number(waterPoints(counts))} ${en ? "points; cloud / no data" : "จุด; เมฆ / ไม่มีข้อมูล"} ${number(cloudPercent(counts))}%</li>`;
  }).join("")}</ol>` : `<p>${unavailable}</p>`;
  const dams = (data.dams?.dams ?? []).filter((dam) => dam.storagePct > 80 || (dam.releaseCms != null && dam.releaseCms >= 100))
    .sort((a, b) => (b.releaseCms ?? -1) - (a.releaseCms ?? -1));
  const damList = data.dams ? `<p>${dams.length} ${en ? "dams; release ≥100 m³/s or storage >80%" : "เขื่อน; ระบาย ≥100 ลบ.ม./วิ หรือความจุ >80%"}</p><ul>${dams.slice(0, 35).map((dam) =>
    `<li>${html(en ? dam.nameEn || dam.nameTh : dam.nameTh)}: ${number(dam.storagePct)}%; ${en ? "release" : "ระบาย"} ${number(dam.releaseCms)} ${en ? "m³/s" : "ลบ.ม./วิ"} · ${date(dam.date)}</li>`).join("")}</ul>` : `<p>${unavailable}</p>`;
  const warnings = data.warnings ? `<p>${data.warnings.items.length} ${en ? "warnings (first 10; original TMD titles)" : "ประกาศ (10 รายการแรก)"}</p><ul>${data.warnings.items.slice(0, 10).map((warning) =>
    `<li>${html(warning.title, 180)} · ${date(warning.announcedAt)}</li>`).join("")}</ul>` : `<p>${unavailable}</p>`;
  return `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${en ? "Thailand water situation — text" : "สถานการณ์น้ำ — หน้า text"}</title></head><body>
<h1>${en ? "Thailand water situation" : "สถานการณ์น้ำท่วมตอนนี้"}</h1>
<nav><a href="/text?lang=th">ไทย</a> · <a href="/text?lang=en">English</a> · <a href="/">${en ? "View full page" : "ดูหน้าเต็ม"}</a></nav>
<section><h2>${en ? "Satellite water: first 10 provinces" : "ดาวเทียมพบน้ำ: 10 จังหวัดแรก"}</h2>${water}<p>${en ? "Satellite sample points, not area or depth. Cloud includes insufficient observations / no data." : "จุดตรวจจากดาวเทียม ไม่ใช่ขนาดพื้นที่หรือความลึก · เมฆรวมจุดตรวจไม่เพียงพอ / ไม่มีข้อมูล"}</p><p>${PROVINCE_CSV_SOURCE} · ${date(data.flood?.date)} · ${checked}</p></section>
<section><h2>${en ? "High dam release / storage >80%" : "เขื่อนระบายมาก / ความจุ >80%"}</h2>${damList}<p>${en ? "RID" : "กรมชลประทาน (RID)"} app.rid.go.th · ${date(data.dams?.dataDate)} · ${checked}</p></section>
<section><h2>${en ? "TMD warnings" : "ประกาศเตือน TMD"}</h2>${warnings}<p>${en ? "Thai Meteorological Department" : "กรมอุตุนิยมวิทยา"} data.tmd.go.th · ${checked}</p><a href="/alerts">${en ? "All alerts" : "ประกาศเตือนทั้งหมด"}</a></section>
<p>${en ? "— = not reported" : "— = ไม่รายงาน"}</p><footer><h2>${en ? "Emergency numbers" : "เบอร์ฉุกเฉิน"}</h2><a href="tel:1784">${en ? "DDPM" : "ปภ."} 1784</a> · <a href="tel:1669">${en ? "Medical" : "เจ็บป่วย"} 1669</a> · <a href="tel:191">${en ? "Emergency" : "เหตุด่วน"} 191</a></footer>
</body></html>`;
}
