"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useT } from "@/i18n/client";
import { intlOf } from "@/i18n/core";
import { oldestCachedAt, subscribeCached } from "@/lib/offline-snapshot";

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => { window.removeEventListener("online", onChange); window.removeEventListener("offline", onChange); };
}

/** Registers the service worker in production and shows when we are offline. */
export function OfflineSupport() {
  const t = useT();
  const online = useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
  const cachedAt = useSyncExternalStore(subscribeCached, oldestCachedAt, () => null);
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
  if (online && !cachedAt) return null;
  const when = cachedAt ? new Intl.DateTimeFormat(intlOf(t), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }).format(new Date(cachedAt)) : null;
  // Fixed to the top so it shows over the full-screen map; each number keeps its own source date below.
  return <p role="status" className="offline-banner">{when ? t("ออฟไลน์ · ข้อมูลเมื่อ {time}", { time: when }) : t("ออฟไลน์อยู่ · แสดงข้อมูลล่าสุดที่โหลดไว้")}</p>;
}
