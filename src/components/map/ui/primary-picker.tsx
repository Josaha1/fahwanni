"use client";

import { isOn, type Feature } from "@/lib/features";
import { useRef, type KeyboardEvent } from "react";
import { useT } from "@/i18n/client";
import type { PrimaryLayer } from "@/lib/map/legend";

export function PrimaryPicker({ primary, tempAvailable, cloudAvailable, pm25Loading, onChange, variant = "segment" }: {
  primary: PrimaryLayer;
  tempAvailable: boolean;
  /** A day cached before cloud cover was fetched has no cloud grid. */
  cloudAvailable: boolean;
  pm25Loading: boolean;
  onChange: (primary: PrimaryLayer) => void;
  variant?: "segment" | "grid";
}) {
  const t = useT();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const candidates: PrimaryLayer[] = variant === "grid" ? ["rain", "temp", "heat", "pm25", "cloud", "satellite"] : [
    "rain", ...(tempAvailable ? ["temp", "heat"] as const : []), "pm25", ...(cloudAvailable ? ["cloud"] as const : []), "satellite",
  ];
  const features: Record<Exclude<PrimaryLayer, "rain">, Feature> = {
    temp: "tempPrimary", heat: "heatPrimary", pm25: "pm25", cloud: "cloudPrimary", satellite: "himawari",
  };
  const options = candidates.filter((option) => option === "rain" || isOn(features[option]));
  const available = (option: PrimaryLayer) => option === "temp" || option === "heat" ? tempAvailable
    : option === "cloud" ? cloudAvailable : true;
  const labels: Record<PrimaryLayer, string> = { rain: "ฝน", temp: "อุณหภูมิ", heat: "ดัชนีความร้อน", pm25: "ฝุ่น PM2.5", cloud: "เมฆ", satellite: "ดาวเทียม" };
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight"
      && (variant !== "grid" || (event.key !== "ArrowUp" && event.key !== "ArrowDown"))) return;
    event.preventDefault();
    let next: number;
    if (variant === "grid") {
      const row = Math.floor(index / 2);
      const column = index % 2;
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        const other = row * 2 + (1 - column);
        next = other < options.length && available(options[other]) ? other : index;
      } else {
        const rows = Math.ceil(options.length / 2);
        next = index;
        for (let offset = 1; offset <= rows; offset++) {
          const candidate = ((row + (event.key === "ArrowDown" ? offset : -offset) + rows) % rows) * 2 + column;
          if (candidate < options.length && available(options[candidate])) { next = candidate; break; }
        }
      }
    } else next = (index + (event.key === "ArrowRight" ? 1 : -1) + options.length) % options.length;
    onChange(options[next]);
    buttons.current[next]?.focus();
  };

  return <div className={variant === "grid" ? "map-segment map-segment--grid" : "map-segment"} role="radiogroup" aria-label={t("ชั้นข้อมูลหลัก")}>
    {options.map((option, index) => <button key={option} ref={(element) => { buttons.current[index] = element; }}
      type="button" role="radio" aria-checked={primary === option} aria-busy={option === "pm25" && pm25Loading} tabIndex={primary === option ? 0 : -1}
      disabled={!available(option) && primary !== option}
      onClick={() => onChange(option)} onKeyDown={(event) => onKeyDown(event, index)}>
      {option === "pm25" && pm25Loading ? t("ฝุ่น PM2.5…") : t(labels[option])}
    </button>)}
  </div>;
}
