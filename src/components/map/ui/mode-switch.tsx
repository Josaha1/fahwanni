"use client";

import { useRef, type KeyboardEvent } from "react";
import { useT } from "@/i18n/client";

type Mode = "weather" | "water";
const MODES: { mode: Mode; label: string }[] = [{ mode: "weather", label: "อากาศ" }, { mode: "water", label: "น้ำ" }];

export function ModeSwitch({ mode, onChange }: { mode: Mode; onChange: (mode: Mode) => void }) {
  const t = useT();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    const next = MODES[(MODES.findIndex((item) => item.mode === mode) + 1) % MODES.length].mode;
    onChange(next);
    buttons.current[MODES.findIndex((item) => item.mode === next)]?.focus();
  };
  return <div role="radiogroup" aria-label={t("โหมดแผนที่")} className="map-panel map-mode-switch" onKeyDown={onKeyDown}>
    {MODES.map((item, index) => <button key={item.mode} ref={(element) => { buttons.current[index] = element; }}
      type="button" role="radio" aria-checked={mode === item.mode} tabIndex={mode === item.mode ? 0 : -1}
      className="map-mode-option" onClick={() => onChange(item.mode)}>{t(item.label)}</button>)}
  </div>;
}
