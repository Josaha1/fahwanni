"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useInstall } from "@/lib/install";
import { useT } from "@/i18n/client";

const dismissalKey = "fah-install-dismissed-until";
const sevenDays = 7 * 24 * 60 * 60 * 1000;

export function InstallButton({ banner = false, compact = false }: { banner?: boolean; compact?: boolean }) {
  const t = useT();
  const { env, android, busy, install } = useInstall();
  const dialog = useRef<HTMLDialogElement>(null);
  const [dismissed, setDismissed] = useState<boolean | null>(null);
  const [url, setUrl] = useState("");

  useEffect(() => {
    function syncDismissal() {
      try {
        const until = Number(localStorage.getItem(dismissalKey));
        setDismissed(Number.isFinite(until) && until > Date.now());
      } catch {
        setDismissed(false);
      }
    }
    syncDismissal();
    window.addEventListener("storage", syncDismissal);
    window.addEventListener("focus", syncDismissal);
    return () => {
      window.removeEventListener("storage", syncDismissal);
      window.removeEventListener("focus", syncDismissal);
    };
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(dismissalKey, String(Date.now() + sevenDays));
    } catch {
      // ยังปิดแบนเนอร์ในหน้านี้ได้ แม้เบราว์เซอร์ไม่อนุญาตให้เก็บข้อมูล
    }
    setDismissed(true);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("คัดลอกลิงก์แล้ว"));
    } catch {
      toast.error(t("คัดลอกไม่ได้ แตะช่องลิงก์ค้างไว้เพื่อคัดลอกนะ"));
    }
  }

  const visible = env && env !== "installed" && (!banner || dismissed === false);
  const intent = url ? `intent://${url.split("://").slice(1).join("://").split("#")[0]}#Intent;scheme=${url.split(":")[0]};package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(url)};end` : "";

  return visible ? (
    <div className={banner ? "install-banner mb-5" : undefined}>
      <button type="button" className={compact ? "btn-primary !min-h-11 !py-2" : "install-action"} disabled={busy} onClick={() => {
        setUrl(window.location.href);
        if (env === "android-prompt") void install();
        else dialog.current?.showModal();
      }}>
        {busy ? t("กำลังติดตั้ง…") : compact ? t("ติดตั้ง") : t("เพิ่มไอคอนลงหน้าจอ")}
      </button>
      {!compact && <p className="mt-2 text-sm text-muted">{t("เปิดฟ้าวันนี้ได้จากหน้าจอโฮม")}</p>}
      {banner && <button type="button" className="install-dismiss" aria-label={t("ซ่อนคำแนะนำติดตั้ง 7 วัน")} onClick={dismiss}>×</button>}
      <dialog ref={dialog} className="sheet install-sheet" aria-labelledby="install-title">
        <h2 id="install-title" className="text-xl font-semibold">{env === "in-app" ? t("เปิดใน {browser}", { browser: android ? "Chrome" : "Safari" }) : t("เพิ่มฟ้าวันนี้ลงหน้าจอ")}</h2>
        {env === "ios-safari" ? (
          <ol className="my-5 list-decimal space-y-3 pl-6">
            <li>{t("แตะปุ่มแชร์ใน Safari")}</li>
            <li>{t("เลือก “เพิ่มไปยังหน้าจอโฮม”")}</li>
            <li>{t("แตะ “เพิ่ม”")}</li>
          </ol>
        ) : env === "in-app" ? (
          <div className="my-5 space-y-4">
            <p>{android ? t("เปิดลิงก์นี้ใน Chrome") : t("เปิดลิงก์นี้ใน Safari")}</p>
            {android && <a className="install-action block text-center" href={intent}>{t("เปิดใน Chrome")}</a>}
            <button type="button" className="install-action w-full" onClick={() => void copyLink()}>{t("คัดลอกลิงก์")}</button>
            <input className="field" aria-label={t("ลิงก์สำหรับเปิดในเบราว์เซอร์")} readOnly value={url} onFocus={(event) => event.target.select()} />
          </div>
        ) : (
          <p className="my-5">{t("เปิดเมนูของเบราว์เซอร์ แล้วเลือก “ติดตั้งแอป” หรือ “เพิ่มไปยังหน้าจอโฮม”")}</p>
        )}
        <button type="button" className="install-action mt-4 w-full" onClick={() => dialog.current?.close()}>{t("เข้าใจแล้ว")}</button>
      </dialog>
    </div>
  ) : null;
}
