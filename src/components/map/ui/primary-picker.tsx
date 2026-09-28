"use client";

import { useRef, type KeyboardEvent } from "react";
import { useT } from "@/i18n/client";
import type { PrimaryLayer } from "@/lib/map/legend";

export function PrimaryPicker({ primary, tempAvailable, onChange }: {
  primary: PrimaryLayer;
  tempAvailable: boolean;
  onChange: (primary: PrimaryLayer) => void;
}) {
  const t = useT();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const options = tempAvailable ? (["rain", "temp"] as const) : (["rain"] as const);
  const labels = { rain: "ฝน", temp: "อุณหภูมิ" } as const;
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const next = (index + (event.key === "ArrowRight" ? 1 : -1) + options.length) % options.length;
    onChange(options[next]);
    buttons.current[next]?.focus();
  };

  return <div className="map-segment" role="radiogroup" aria-label={t("ชั้นข้อมูลหลัก")}>
    {options.map((option, index) => <button key={option} ref={(element) => { buttons.current[index] = element; }}
      type="button" role="radio" aria-checked={primary === option} tabIndex={primary === option ? 0 : -1}
      onClick={() => onChange(option)} onKeyDown={(event) => onKeyDown(event, index)}>
      {t(labels[option])}
    </button>)}
  </div>;
}
