"use client";

import { useEffect, useState } from "react";
import { useT } from "@/i18n/client";
import type { Webcam } from "@/lib/webcams";

/** "กล้องสดใกล้คุณ" — nearby Windy webcams; hidden when the feature has no key or nothing is near. */
export function WebcamsCard({ lat, lon }: { lat: number; lon: number }) {
  const t = useT();
  const [state, setState] = useState<{ key: string; webcams: Webcam[] } | null>(null);
  const key = `${lat},${lon}`;
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/webcams?lat=${lat}&lon=${lon}`, { signal: controller.signal })
      .then((response) => response.status === 200 ? response.json() as Promise<{ webcams?: Webcam[] }> : null)
      .then((data) => { if (data?.webcams?.length) setState({ key, webcams: data.webcams.slice(0, 3) }); }).catch(() => {});
    return () => controller.abort();
  }, [lat, lon, key]);
  if (!state || state.key !== key) return null;
  return <section className="placeholder-card space-y-2" aria-label={t("กล้องสดใกล้คุณ")}>
    <h2 className="text-lg font-semibold">{t("กล้องสดใกล้คุณ")}</h2>
    <ul className="grid gap-2">{state.webcams.map((cam) => <li key={cam.id}>
      {/* Windy terms: images only from the API URLs, each linked to its webcam page, credited to Windy.com. */}
      <a href={cam.page} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-lg border border-border">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={cam.image} alt={t("ภาพจากกล้อง {title}", { title: cam.title || cam.city })} loading="lazy" className="aspect-video w-full object-cover" />
        <span className="block px-2 py-1 text-xs">{cam.title || cam.city} · {t("ภาพจาก Windy.com")}</span>
      </a>
    </li>)}</ul>
    <p className="text-muted text-xs">{t("ภาพสดจากกล้องสาธารณะ ผ่าน Windy.com · แตะเพื่อดูภาพเคลื่อนไหว")}</p>
  </section>;
}
