"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useT } from "@/i18n/client";
import { completeMenuTip, shouldShowMenuTip } from "@/lib/menu-tip";

const steps = [
  { title: "แท็บน้ำ", text: "ดูสถานการณ์น้ำใกล้คุณได้ที่แท็บน้ำด้านล่าง", href: "/water", link: "ไปที่แท็บน้ำ" },
  { title: "ปุ่มชั้นข้อมูล", text: "บนแผนที่ แตะปุ่มชั้นข้อมูลเพื่อเลือกข้อมูลที่อยากดู", href: "/map", link: "เปิดแผนที่" },
  { title: "ดาวเทียมและน้ำท่วม", text: "ในชั้นข้อมูล เลือกภาพดาวเทียมหรือน้ำท่วมจากดาวเทียมได้", href: "/map?mode=water", link: "ดูแผนที่น้ำ" },
] as const;

export function MenuTip({ onClose }: { onClose: () => void }) {
  const t = useT();
  const [step, setStep] = useState<number | null>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (shouldShowMenuTip()) setStep(0);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  if (step === null) return null;

  function close() {
    completeMenuTip();
    setStep(null);
    onClose();
  }

  const current = steps[step];
  return <section className="placeholder-card mb-4 px-4 py-3" aria-label={t("แนะนำเมนูใหม่")}>
    <div className="flex items-start justify-between gap-3">
      <h2 className="text-base font-semibold">{t("แนะนำเมนูใหม่")}</h2>
      <span className="shrink-0 text-sm text-muted" aria-label={t("ขั้นที่ {step} จาก {total}", { step: step + 1, total: steps.length })}>{step + 1}/{steps.length}</span>
    </div>
    <div aria-live="polite">
      <p className="mt-2 font-medium">{t(current.title)}</p>
      <p className="mt-1 text-sm text-muted">{t(current.text)}</p>
    </div>
    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
      <Link href={current.href} className="inline-flex min-h-11 items-center text-sm text-given underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-given">{t(current.link)}</Link>
      <div className="flex gap-2">
        <button type="button" className="min-h-11 rounded-xl px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-given" onClick={close}>{t("ปิดคำแนะนำ")}</button>
        <button type="button" className="btn-primary !min-h-11 !px-4 !py-2 text-sm" onClick={() => step === steps.length - 1 ? close() : setStep(step + 1)}>{step === steps.length - 1 ? t("เข้าใจแล้ว") : t("ถัดไป")}</button>
      </div>
    </div>
  </section>;
}
