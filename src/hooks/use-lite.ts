"use client";

import { useEffect, useState } from "react";
import { liteDefault, readDeviceEnv, type DeviceEnv } from "@/lib/device";

const KEY = "fah-lite";
const EVENT = `${KEY}-change`;
let visitOverride: boolean | null = null;

function readOverride(): boolean | null {
  try {
    const saved = localStorage.getItem(KEY);
    return saved === "true" ? true : saved === "false" ? false : null;
  } catch { return visitOverride; }
}

export function useLite() {
  // Start from the server's values so hydration matches; the effect below reads the real device and saved choice.
  const [device, setDevice] = useState<DeviceEnv>({ reducedMotion: false, saveData: false });
  const [liteOverride, setLiteOverride] = useState<boolean | null>(null);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setDevice(readDeviceEnv());
    const onChange = (event: Event) => setLiteOverride((event as CustomEvent<boolean>).detail);
    const onStorage = (event: StorageEvent) => { if (event.key === KEY || event.key === null) setLiteOverride(readOverride()); };
    let active = true;
    queueMicrotask(() => {
      if (active) { update(); setLiteOverride(readOverride()); }
    });
    query.addEventListener("change", update);
    window.addEventListener(EVENT, onChange);
    window.addEventListener("storage", onStorage);
    return () => {
      active = false;
      query.removeEventListener("change", update);
      window.removeEventListener(EVENT, onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const automaticLite = liteDefault(device);
  const lite = liteOverride ?? automaticLite;
  const toggleLite = () => {
    const next = !lite;
    visitOverride = next;
    setLiteOverride(next);
    try { localStorage.setItem(KEY, String(next)); } catch { /* Keep the setting for this visit only. */ }
    window.dispatchEvent(new CustomEvent(EVENT, { detail: next }));
  };
  return { device, reducedMotion: device.reducedMotion, lite, liteOverride, automaticLite, toggleLite };
}
