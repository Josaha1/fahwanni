"use client";

import { useRef, useState } from "react";
import { InstallButton } from "@/components/install-button";
import { LanguageSwitch } from "@/components/language-switch";
import { useT } from "@/i18n/client";

type ThemeChoice = "auto" | "light" | "dark";

export function SettingsSheet() {
  const t = useT();
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [theme, setTheme] = useState<ThemeChoice>("auto");
  const [confirmClear, setConfirmClear] = useState(false);

  function open() {
    const choice = document.documentElement.dataset.themeChoice;
    setTheme(choice === "light" || choice === "dark" ? choice : "auto");
    setConfirmClear(false);
    dialog.current?.showModal();
  }

  function chooseTheme(choice: ThemeChoice) {
    try { localStorage.setItem("fah-theme", choice); }
    catch { /* The choice still applies for this page when storage is unavailable. */ }
    window.dispatchEvent(new CustomEvent("fah-theme-change", { detail: choice }));
    setTheme(choice);
  }

  async function clearData() {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    for (let index = localStorage.length - 1; index >= 0; index--) {
      const key = localStorage.key(index);
      if (key?.startsWith("fah-")) localStorage.removeItem(key);
    }
    if ("serviceWorker" in navigator) {
      const worker = navigator.serviceWorker.controller ?? (await navigator.serviceWorker.getRegistration())?.active;
      worker?.postMessage({ type: "clear-cache" });
    }
    window.location.reload();
  }

  return <>
    <button ref={trigger} type="button" aria-label={t("ตั้งค่า")} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-card text-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-given" onClick={open}>
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d="M12 2.75 13.7 4l2.1-.2.9 1.9 2 .8-.2 2.1L19.75 10l-.7 2  .7 2-1.25 1.4.2 2.1-2 .8-.9 1.9-2.1-.2L12 21.25 10.3 20l-2.1.2-.9-1.9-2-.8.2-2.1L4.25 14l.7-2-.7-2L5.5 8.6l-.2-2.1 2-.8.9-1.9 2.1.2L12 2.75Z"/><circle cx="12" cy="12" r="3"/></svg>
    </button>
    <dialog ref={dialog} className="sheet install-sheet" aria-labelledby="settings-title" onClose={() => { setConfirmClear(false); trigger.current?.focus(); }} onClick={(event) => {
      if (event.target !== event.currentTarget) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) event.currentTarget.close();
    }}>
      <div className="flex items-center justify-between gap-3">
        <h2 id="settings-title" className="text-xl">{t("ตั้งค่า")}</h2>
        <button type="button" aria-label={t("ปิดการตั้งค่า")} className="flex h-11 w-11 items-center justify-center rounded-full text-2xl text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-given" onClick={() => dialog.current?.close()}>×</button>
      </div>
      <div className="mt-5 space-y-5">
        <fieldset>
          <legend className="mb-2 font-semibold">{t("ธีม")}</legend>
          <div className="flex flex-wrap gap-2">
            {([["auto", "อัตโนมัติ"], ["light", "สว่าง"], ["dark", "มืด"]] as const).map(([choice, label]) => <button key={choice} type="button" className="chip" aria-pressed={theme === choice} onClick={() => chooseTheme(choice)}>{t(label)}</button>)}
          </div>
        </fieldset>
        <div>
          <p className="mb-2 font-semibold">{t("ภาษา")}</p>
          <LanguageSwitch />
        </div>
        <InstallButton compact />
        <button type="button" className="install-action w-full" onClick={() => void clearData()}>{confirmClear ? t("แตะอีกครั้งเพื่อยืนยัน") : t("ล้างข้อมูลในเครื่อง")}</button>
      </div>
      <footer className="mt-6 border-t border-border pt-4 text-xs leading-relaxed text-muted">
        <p>{t("ข้อมูลพยากรณ์: Google Weather API (WeatherNext 3) · คุณภาพอากาศ: Google Air Quality API · ค้นหาสถานที่: Open-Meteo")}</p>
        <p className="mt-2">{t("คำเตือนคำนวณจากข้อมูลพยากรณ์ ไม่ใช่ประกาศทางการ โปรดติดตามประกาศจาก")} <a className="underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-given" href="https://www.tmd.go.th" target="_blank" rel="noopener noreferrer">{t("กรมอุตุนิยมวิทยา")}</a></p>
      </footer>
    </dialog>
  </>;
}
