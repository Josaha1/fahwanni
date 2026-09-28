"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setLocale } from "@/app/locale-actions";
import { useLocale } from "@/i18n/client";

/** ไทย / English toggle for this device. */
export function LanguageSwitch({ className = "" }: { className?: string }) {
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  function choose(next: "th" | "en") {
    if (next === locale) return;
    startTransition(async () => {
      await setLocale(next);
      router.refresh();
    });
  }
  return <div role="group" aria-label="ภาษา / Language" className={`inline-flex rounded-full border border-border bg-card p-1 text-sm ${className}`} aria-busy={pending}>
    {([["th", "ไทย"], ["en", "English"]] as const).map(([value, label]) => <button key={value} type="button" lang={value}
      aria-pressed={locale === value} disabled={pending}
      className={`min-h-9 rounded-full px-3 ${locale === value ? "bg-given font-semibold text-white" : "text-muted"}`}
      onClick={() => choose(value)}>{label}</button>)}
  </div>;
}
