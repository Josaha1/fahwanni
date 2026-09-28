"use client";

import { useState } from "react";
import { TZDate } from "@date-fns/tz";
import { useT } from "@/i18n/client";
import type { AirSnapshot } from "@/lib/air";
import { bestWindow, type Activity } from "@/lib/best-time";
import { formatTime } from "@/lib/format";
import type { WeatherSnapshot } from "@/lib/weather/types";

const ACTIVITIES: { id: Activity; label: string }[] = [
  { id: "outdoor", label: "ออกไปข้างนอก" },
  { id: "exercise", label: "ออกกำลังกายกลางแจ้ง" },
];

/** "When is the best time?" — best 2-hour daytime window per activity in the next 24 h. */
export function BestTimeCard({ snapshot, air }: { snapshot: WeatherSnapshot; air?: AirSnapshot }) {
  const t = useT();
  const [now] = useState(() => new Date().toISOString());
  const zone = snapshot.timeZone ?? "Asia/Bangkok";
  const rows = ACTIVITIES.map(({ id, label }) => ({ id, label, window: bestWindow(snapshot.hours, zone, now, id, air?.pm25) }));
  if (rows.every((row) => !row.window)) return null;
  return (
    <section className="placeholder-card" aria-label={t("ช่วงเวลาที่ดีที่สุด")}>
      <h2 className="text-xl">{t("ช่วงเวลาที่ดีที่สุด")}</h2>
      <ul className="mt-3 space-y-2">
        {rows.map(({ id, label, window }) => (
          <li key={id} className="flex items-center justify-between gap-3 rounded-xl bg-background px-3 py-2">
            <span className="text-sm">{t(label)}</span>
            <span className="text-right text-sm font-semibold">
              {!window ? "—"
                : window.good
                  ? `${new TZDate(window.start, zone).getDate() !== new TZDate(now, zone).getDate() ? `${t("พรุ่งนี้")} ` : ""}${t("{from}–{to} น.", { from: formatTime(window.start, zone, t.locale), to: formatTime(window.end, zone, t.locale) })}`
                  : <span className="font-normal text-muted">{t("วันนี้ไม่ค่อยเหมาะ")}</span>}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
