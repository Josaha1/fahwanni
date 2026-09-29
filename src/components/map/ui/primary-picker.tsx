"use client";

import { useRef, type KeyboardEvent } from "react";
import { useT } from "@/i18n/client";
import type { PrimaryLayer } from "@/lib/map/legend";

export function PrimaryPicker({ primary, tempAvailable, cloudAvailable, pm25Loading, onChange }: {
  primary: PrimaryLayer;
  tempAvailable: boolean;
  /** A day cached before cloud cover was fetched has no cloud grid. */
  cloudAvailable: boolean;
  pm25Loading: boolean;
  onChange: (primary: PrimaryLayer) => void;
}) {
  const t = useT();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const options: PrimaryLayer[] = [
    "rain", ...(tempAvailable ? ["temp", "heat"] as const : []), "pm25", ...(cloudAvailable ? ["cloud"] as const : []),
  ];
  const labels: Record<PrimaryLayer, string> = { rain: "ฝน", temp: "อุณหภูมิ", heat: "ดัชนีความร้อน", pm25: "ฝุ่น PM2.5", cloud: "เมฆ" };
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const next = (index + (event.key === "ArrowRight" ? 1 : -1) + options.length) % options.length;
    onChange(options[next]);
    buttons.current[next]?.focus();
  };

  return <div className="map-segment" role="radiogroup" aria-label={t("ชั้นข้อมูลหลัก")}>
    {options.map((option, index) => <button key={option} ref={(element) => { buttons.current[index] = element; }}
      type="button" role="radio" aria-checked={primary === option} aria-busy={option === "pm25" && pm25Loading} tabIndex={primary === option ? 0 : -1}
      onClick={() => onChange(option)} onKeyDown={(event) => onKeyDown(event, index)}>
      {option === "pm25" && pm25Loading ? t("ฝุ่น PM2.5…") : t(labels[option])}
    </button>)}
  </div>;
}
