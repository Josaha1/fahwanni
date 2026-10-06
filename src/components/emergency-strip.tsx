"use client";

import { useT } from "@/i18n/client";
import "./emergency-strip.css";

export function EmergencyStrip() {
  const t = useT();
  return <nav className="emergency-strip" aria-label={t("เบอร์ฉุกเฉิน")}>
    <a href="tel:1784">{t("ปภ. 1784")}</a>
    <a href="tel:1669">{t("เจ็บป่วย 1669")}</a>
    <a href="tel:191">{t("เหตุด่วน 191")}</a>
  </nav>;
}
