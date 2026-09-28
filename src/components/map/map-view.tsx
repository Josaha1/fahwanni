"use client";

import { useEffect, useRef, useState } from "react";
import { AttributionControl, Map, Marker, NavigationControl, setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { version } from "maplibre-gl/package.json";
import { useLastPlace } from "@/hooks/use-favourites";
import { useT } from "@/i18n/client";

setWorkerUrl(`/vendor/maplibre/${version}/maplibre-gl-worker.mjs`);

const styles = {
  light: "https://tiles.openfreemap.org/styles/positron",
  dark: "https://tiles.openfreemap.org/styles/dark",
};

function currentStyle() {
  const theme = document.documentElement.dataset.theme;
  return theme === "dark" || theme === "night" ? styles.dark : styles.light;
}

export function MapView() {
  const { place } = useLastPlace();
  const t = useT();
  const placeName = place.source === "gps" ? t("ตำแหน่งปัจจุบัน") : t.locale === "en" && place.source === "province" ? place.admin ?? place.name : place.name;
  const container = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!container.current) return;
    let map: Map | undefined;
    let marker: Marker | undefined;
    let waitingForStyle = true;
    try {
      map = new Map({
        container: container.current,
        style: currentStyle(),
        center: [place.lon, place.lat],
        zoom: 6,
        minZoom: 3,
        maxZoom: 12,
        maxBounds: [[80, -5], [130, 30]],
        pixelRatio: Math.min(window.devicePixelRatio || 1, 1.5),
        fadeDuration: 100,
        attributionControl: false,
      });
      const liveMap = map;
      liveMap.addControl(new NavigationControl(), "top-right");
      liveMap.addControl(new AttributionControl({ compact: true }), "bottom-right");
      const pin = document.createElement("div");
      pin.setAttribute("role", "img");
      pin.setAttribute("aria-label", placeName);
      pin.className = "h-5 w-5 rounded-full border-[3px] border-white bg-given shadow-lg";
      marker = new Marker({ element: pin }).setLngLat([place.lon, place.lat]).addTo(liveMap);

      liveMap.on("idle", () => {
        if (waitingForStyle) {
          waitingForStyle = false;
          setStatus("ready");
        }
      });
      liveMap.on("error", () => {
        if (waitingForStyle) {
          waitingForStyle = false;
          setStatus("error");
        }
      });

      let style = currentStyle();
      const observer = new MutationObserver(() => {
        const next = currentStyle();
        if (next === style) return;
        style = next;
        waitingForStyle = true;
        setStatus("loading");
        liveMap.setStyle(next);
      });
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
      return () => {
        observer.disconnect();
        marker?.remove();
        liveMap.remove();
      };
    } catch {
      marker?.remove();
      map?.remove();
      const timer = window.setTimeout(() => setStatus("error"), 0);
      return () => window.clearTimeout(timer);
    }
  }, [place.lon, place.lat, placeName, attempt]);

  return (
    <main className="mx-auto flex h-[calc(100dvh-73px-env(safe-area-inset-bottom))] max-w-3xl flex-col overflow-hidden">
      <header className="shrink-0 px-5 py-2" style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}>
        <h1 className="text-lg">{t("แผนที่")} · {placeName}</h1>
      </header>
      <div className="relative min-h-0 flex-1 bg-sky">
        <div ref={container} className="absolute inset-0" style={{ position: "absolute" }} aria-label={t("แผนที่")} />
        {status !== "ready" && (
          <div className="absolute inset-0 z-10 grid place-items-center bg-background/90" role="status">
            {status === "error" ? (
              <div className="text-center">
                <p>{t("โหลดแผนที่ไม่สำเร็จ")}</p>
                <button type="button" className="install-action mt-3" onClick={() => { setStatus("loading"); setAttempt((value) => value + 1); }}>{t("ลองใหม่")}</button>
              </div>
            ) : t("กำลังโหลดแผนที่…")}
          </div>
        )}
      </div>
    </main>
  );
}
