import type { RefObject } from "react";
import { useT } from "@/i18n/client";

export function ShortcutsDialog({ dialogRef, triggerRef }: {
  dialogRef: RefObject<HTMLDialogElement | null>;
  triggerRef: RefObject<HTMLElement | null>;
}) {
  const t = useT();
  const rows = [
    { keys: "Space", action: "เล่น / หยุด (อากาศหรือน้ำ)" },
    { keys: "← / →", action: "ก่อนหน้า / ถัดไป 1 ชั่วโมง (อากาศ) หรือ 1 วัน (น้ำ)" },
    { keys: "1 / 2 / 3 / 4 / 5", action: "ฝน / อุณหภูมิ / ดัชนีความร้อน / ฝุ่น PM2.5 / เมฆ (อากาศ)" },
    { keys: "W / A", action: "โหมดน้ำ / โหมดอากาศ" },
    { keys: "?", action: "แสดงปุ่มลัด" },
  ];
  return <dialog ref={dialogRef} className="map-panel map-legend-dialog" aria-labelledby="map-shortcuts-title"
    onClose={() => triggerRef.current?.focus()}>
    <div className="flex items-center justify-between gap-3">
      <h2 id="map-shortcuts-title" className="text-lg font-semibold">{t("ปุ่มลัด")}</h2>
      <button type="button" className="map-icon-btn shrink-0" aria-label={t("ปิด")} onClick={() => dialogRef.current?.close()}>✕</button>
    </div>
    <table className="mt-4 w-full text-left text-sm">
      <tbody>{rows.map((row) => <tr key={row.keys} className="border-t" style={{ borderColor: "var(--map-panel-border)" }}>
        <th scope="row" className="whitespace-nowrap py-2 pr-3 align-top font-semibold">{row.keys}</th>
        <td className="py-2">{t(row.action)}</td>
      </tr>)}</tbody>
    </table>
  </dialog>;
}
