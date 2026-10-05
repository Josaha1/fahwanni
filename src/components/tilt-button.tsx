"use client";

import { useT } from "@/i18n/client";

export function TiltButton() {
  const t = useT();
  return <button type="button" data-enable-tilt="" hidden aria-pressed="false"
    className="min-h-11 rounded-full border border-[var(--border)] bg-[var(--card)] px-3 text-xs font-semibold text-given">
    {t("เอียงมือถือเพื่อหมุนภาพ")}
  </button>;
}
