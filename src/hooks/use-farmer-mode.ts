"use client";

import { useSyncExternalStore } from "react";

const KEY = "fah-farmer";
const EVENT = `${KEY}-change`;

function subscribe(onChange: () => void) {
  const onStorage = (event: StorageEvent) => { if (event.key === KEY) onChange(); };
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => { window.removeEventListener(EVENT, onChange); window.removeEventListener("storage", onStorage); };
}

function read(): boolean {
  try { return localStorage.getItem(KEY) === "1"; } catch { return false; }
}

/** Farmer mode (settings): extra farming card on the forecast page, stored on this device. */
export function useFarmerMode(): [boolean, (on: boolean) => void] {
  const on = useSyncExternalStore(subscribe, read, () => false);
  const set = (next: boolean) => {
    try { localStorage.setItem(KEY, next ? "1" : "0"); } catch { /* optional */ }
    window.dispatchEvent(new Event(EVENT));
  };
  return [on, set];
}
