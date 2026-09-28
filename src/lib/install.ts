"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useT } from "@/i18n/client";

export type InstallEnv = "android-prompt" | "ios-safari" | "in-app" | "installed" | "other";

export function detectInstallEnv(ua: string, standalone: boolean, hasPrompt: boolean, maxTouchPoints = 0): InstallEnv {
  if (standalone) return "installed";
  if (/Line\/|FBAN|FBAV|Instagram/i.test(ua)) return "in-app";
  const ios = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && maxTouchPoints > 1);
  if (ios && /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua)) return "ios-safari";
  if (hasPrompt) return "android-prompt";
  return "other";
}

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function useInstall() {
  const t = useT();
  const [env, setEnv] = useState<InstallEnv | null>(null);
  const [android, setAndroid] = useState(false);
  const [busy, setBusy] = useState(false);
  const pending = useRef<InstallPromptEvent | null>(null);
  const installing = useRef(false);
  const installed = useRef(false);
  const refresh = useRef<() => void>(() => {});

  useEffect(() => {
    const mode = window.matchMedia("(display-mode: standalone)");
    const update = () => {
      const standalone = installed.current || mode.matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
      setEnv(detectInstallEnv(navigator.userAgent, standalone, Boolean(pending.current), navigator.maxTouchPoints));
      setAndroid(/Android/i.test(navigator.userAgent));
    };
    refresh.current = update;
    const onPrompt = (event: Event) => {
      event.preventDefault();
      pending.current = event as InstallPromptEvent;
      update();
    };
    const onInstalled = () => {
      installed.current = true;
      pending.current = null;
      update();
      toast.success(t("ติดตั้งแล้ว"));
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    mode.addEventListener("change", update);
    update();
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      mode.removeEventListener("change", update);
      refresh.current = () => {};
    };
  }, [t]);

  async function install() {
    const event = pending.current;
    if (!event || installing.current) return;
    installing.current = true;
    setBusy(true);
    pending.current = null;
    try {
      await event.prompt();
      await event.userChoice;
    } catch {
      toast.error(t("ยังติดตั้งไม่ได้ ลองอีกครั้งผ่านเมนูของเบราว์เซอร์นะ"));
    } finally {
      installing.current = false;
      setBusy(false);
      refresh.current();
    }
  }

  return { env, android, busy, install };
}
