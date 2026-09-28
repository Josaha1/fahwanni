"use client";

import { useEffect } from "react";
import { resolveTheme } from "@/lib/theme";

const key = "fah-theme";

export function ThemeController() {
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    let choice: string | null = null;

    function readChoice() {
      try { choice = localStorage.getItem(key); }
      catch { choice = null; }
    }

    function apply() {
      const selected = resolveTheme(choice, new Date().getHours(), media.matches);
      document.documentElement.dataset.themeChoice = selected.choice;
      document.documentElement.dataset.theme = selected.theme;
    }

    function onStorage(event: StorageEvent) {
      if (event.key !== key && event.key !== null) return;
      readChoice();
      apply();
    }

    function onChange(event: Event) {
      choice = (event as CustomEvent<string>).detail;
      apply();
    }

    readChoice();
    apply();
    media.addEventListener("change", apply);
    window.addEventListener("fah-theme-change", onChange);
    window.addEventListener("storage", onStorage);
    const timer = window.setInterval(apply, 60000);
    return () => {
      media.removeEventListener("change", apply);
      window.removeEventListener("fah-theme-change", onChange);
      window.removeEventListener("storage", onStorage);
      window.clearInterval(timer);
    };
  }, []);
  return null;
}
