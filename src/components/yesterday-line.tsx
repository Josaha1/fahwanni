"use client";

import { useEffect, useMemo } from "react";
import { useT } from "@/i18n/client";
import type { WeatherSnapshot } from "@/lib/weather/types";
import { diffFromYesterday, recordDay } from "@/lib/yesterday";

/** "วันนี้ร้อนกว่าเมื่อวาน ~2°" — only once the device has seen this place yesterday. */
export function YesterdayLine({ snapshot, lat, lon }: { snapshot: WeatherSnapshot; lat: number; lon: number }) {
  const t = useT();
  const today = snapshot.days[0];
  const date = today?.date;
  const maxC = today?.maxTempC;
  const diff = useMemo(() => {
    if (!date || maxC === undefined) return undefined;
    try { return diffFromYesterday(localStorage, lat, lon, date, maxC); } catch { return undefined; }
  }, [date, maxC, lat, lon]);

  useEffect(() => {
    if (!date || maxC === undefined) return;
    try { recordDay(localStorage, lat, lon, date, maxC, today?.minTempC); } catch { /* optional */ }
  }, [date, maxC, lat, lon, today?.minTempC]);

  if (diff === undefined) return null;
  const text = diff >= 1 ? t("วันนี้ร้อนกว่าเมื่อวาน ~{n}°", { n: diff })
    : diff <= -1 ? t("วันนี้เย็นกว่าเมื่อวาน ~{n}°", { n: -diff })
      : t("อุณหภูมิใกล้เคียงเมื่อวาน");
  return <p className="text-sm text-muted">{text}</p>;
}
