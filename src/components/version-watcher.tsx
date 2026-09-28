"use client";

import { useEffect } from "react";
import { shouldReload } from "@/lib/version";

const CHECK_EVERY_MS = 10 * 60_000;

/**
 * The installed iOS app resumes the old page instead of reloading, so after a redeploy its server
 * actions no longer exist (404). Check the live build whenever the app comes back to the screen.
 */
export function VersionWatcher() {
  useEffect(() => {
    let checking = false;
    async function check() {
      if (checking || document.visibilityState !== "visible") return;
      checking = true;
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        const { buildId } = (await res.json()) as { buildId: string | null };
        if (shouldReload({ current: process.env.NEXT_PUBLIC_BUILD_ID, latest: buildId, sheetOpen: !!document.querySelector("dialog[open]") })) {
          window.location.reload();
        }
      } catch {
        // Offline or server hiccup: try again on the next check.
      } finally { checking = false; }
    }
    const timer = setInterval(check, CHECK_EVERY_MS);
    document.addEventListener("visibilitychange", check);
    window.addEventListener("pageshow", check);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("pageshow", check);
    };
  }, []);
  return null;
}
