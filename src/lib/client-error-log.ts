"use client";

import { sanitizeErrorMessage } from "./error-log";

const reported = new WeakSet<Error>();

export function reportClientError(error: Error & { digest?: string }, kind: "route" | "global") {
  if (reported.has(error)) return;
  reported.add(error);
  const payload = JSON.stringify({
    message: sanitizeErrorMessage(error.message),
    digest: error.digest,
    path: window.location.pathname,
    kind,
    ts: Date.now(),
  });
  const blob = new Blob([payload], { type: "application/json" });
  let sent = false;
  try { sent = navigator.sendBeacon?.("/api/log", blob) ?? false; } catch { /* Fall back when beacon is unavailable. */ }
  if (!sent) {
    void fetch("/api/log", { method: "POST", body: payload, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => {});
  }
}
