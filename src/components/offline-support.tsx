"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useT } from "@/i18n/client";

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => { window.removeEventListener("online", onChange); window.removeEventListener("offline", onChange); };
}

/** Registers the service worker in production and shows when we are offline. */
export function OfflineSupport() {
  const t = useT();
  const online = useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).then(async () => {
        const registration = await navigator.serviceWorker.ready;
        const urls = [...new Set([
          location.origin + "/",
          ...performance.getEntriesByType("resource").map((entry) => entry.name),
        ])].slice(0, 200);
        registration.active?.postMessage({ type: "warm-cache", urls });
      }).catch(() => {});
    }
  }, []);
  if (online) return null;
  return <p role="status" className="mb-4 rounded-2xl bg-border px-4 py-2 text-center text-sm">{t("ออฟไลน์อยู่ · แสดงข้อมูลล่าสุดที่โหลดไว้")}</p>;
}
