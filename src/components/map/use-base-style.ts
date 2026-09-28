"use client";

import { useEffect, useState } from "react";
import type { StyleSpecification } from "maplibre-gl";
import { baseStyle, mapThemeFor, STYLE_URLS, type BaseTheme } from "@/lib/map/base-style";

const stylePromises: Partial<Record<BaseTheme, Promise<StyleSpecification>>> = {};

export function loadBaseStyle(theme: BaseTheme): Promise<StyleSpecification> {
  if (!stylePromises[theme]) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15_000);
    stylePromises[theme] = fetch(STYLE_URLS[theme], { signal: controller.signal })
      .then((response) => { if (!response.ok) throw new Error("map style unavailable"); return response.json() as Promise<StyleSpecification>; })
      .then((json) => baseStyle(theme, json))
      .catch((error) => { delete stylePromises[theme]; throw error; })
      .finally(() => window.clearTimeout(timeout));
  }
  return stylePromises[theme];
}

export function useAppMapTheme(): BaseTheme {
  const [theme, setTheme] = useState<BaseTheme>("dark");

  useEffect(() => {
    const root = document.documentElement;
    const update = () => setTheme(mapThemeFor(root.dataset.theme));
    update();
    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  return theme;
}
