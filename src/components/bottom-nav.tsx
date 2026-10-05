"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/i18n/client";
import { useLastPlace } from "@/hooks/use-favourites";
import { BASE } from "@/lib/map/base-style";
import { distanceKm } from "@/lib/storms/normalize";
import { statusWord } from "@/lib/rivers/status";
import type { RiverStatus } from "@/lib/rivers/types";
import { hasNews, readSeen, type NewsItem } from "@/lib/water/whats-new";
import { readWatch } from "@/lib/water/watchlist";
import { useAppMapTheme } from "./map/use-base-style";

export function BottomNav() {
  const pathname = usePathname();
  const t = useT();
  const { place } = useLastPlace();
  const onMap = pathname === "/map";
  const navRef = useRef<HTMLElement>(null);
  const [news, setNews] = useState(false);
  const theme = useAppMapTheme();
  const colors = BASE[theme];

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const update = () => document.documentElement.style.setProperty("--nav-h", `${nav.getBoundingClientRect().height}px`);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(nav);
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty("--nav-h");
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const update = () => {
      const seen = readSeen();
      if (!seen) { setNews(false); return; }
      Promise.all([fetch("/api/rivers"), fetch("/api/dams")]).then(async ([riverResponse, damResponse]) => {
        if (!riverResponse.ok || !damResponse.ok) return;
        const rivers = await riverResponse.json() as { points?: { id: string; nameTh: string; nameEn: string; lat: number; lon: number; summary?: { today: { value: number; date: string; status: RiverStatus } } }[] };
        const dams = await damResponse.json() as { dams?: { id: string; nameTh: string; nameEn: string; storagePct: number; date: string }[] };
        if (cancelled || !Array.isArray(rivers.points) || !Array.isArray(dams.dams)) return;
        const watch = readWatch();
        const nearest = new Set([...rivers.points].sort((a, b) => distanceKm(place, a) - distanceKm(place, b)).slice(0, 3).map((point) => point.id));
        const items: NewsItem[] = [
          ...rivers.points.filter((point) => point.summary && (nearest.has(point.id) || watch[`river:${point.id}`])).map((point) => ({
            key: `river:${point.id}` as const, label: t.locale === "en" ? point.nameEn || point.nameTh : point.nameTh,
            value: point.summary!.today.value, unit: "cms" as const, status: statusWord(point.summary!.today.status), date: point.summary!.today.date,
          })),
          ...dams.dams.filter((dam) => watch[`dam:${dam.id}`]).map((dam) => ({
            key: `dam:${dam.id}` as const, label: t.locale === "en" ? dam.nameEn || dam.nameTh : dam.nameTh,
            value: dam.storagePct, unit: "pct" as const, date: dam.date,
          })),
        ];
        setNews(hasNews(seen, items));
      }).catch(() => {});
    };
    const idle = window.requestIdleCallback ? window.requestIdleCallback(update) : window.setTimeout(update, 500);
    window.addEventListener("fah-water-seen-change", update);
    window.addEventListener("fah-water-watch-change", update);
    return () => {
      cancelled = true;
      if (window.cancelIdleCallback) window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
      window.removeEventListener("fah-water-seen-change", update);
      window.removeEventListener("fah-water-watch-change", update);
    };
  }, [place, t.locale]);

  return (
    <nav ref={navRef} className="bottom-nav flex gap-2" aria-label={t("นำทางหลัก")}
      style={onMap ? { backgroundColor: colors.bg, borderColor: colors.panelBorder, backdropFilter: "blur(12px)" } : undefined}>
      <Link href="/" aria-current={pathname === "/" ? "page" : undefined} className="nav-tab min-w-0 flex-1 flex-col gap-1 text-foreground"
        style={onMap ? { color: colors.label, backgroundColor: "transparent" } : undefined}>
        <svg aria-hidden="true" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="m4 11 8-7 8 7M7 9v6M17 9v6" />
          <path d="M2 17c2-2 4 2 6 0s4 2 6 0 4 2 8 0M2 21c2-2 4 2 6 0s4 2 6 0 4 2 8 0" />
        </svg>
        <span className="max-w-full break-words text-center leading-tight">{t("ท่วมตอนนี้")}</span>
      </Link>
      <Link href="/water" aria-current={pathname === "/water" ? "page" : undefined} className="nav-tab relative min-w-0 flex-1 flex-col gap-1 text-foreground">
        <svg aria-hidden="true" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 15 8 4h8l4 11M7 8h10M5 12h14M12 12v7m-3-3 3 3 3-3M2 22c2-2 4 2 6 0s4 2 6 0 4 2 8 0" />
        </svg>
        <span className="max-w-full break-words text-center leading-tight">{t("ระบายน้ำ")}</span>
        {news && <span className="absolute right-2 top-1 h-2.5 w-2.5 rounded-full bg-[var(--missed)]" aria-label={t("มีข้อมูลใหม่")} />}
      </Link>
      <Link href="/rain" aria-current={pathname === "/rain" ? "page" : undefined} className="nav-tab min-w-0 flex-1 flex-col gap-1 text-foreground">
        <svg aria-hidden="true" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 15a5 5 0 0 1 3-9 7 7 0 0 1 13 2 4 4 0 0 1 1 7H3Z" />
          <path d="m8 18-1 3m6-3-1 3m6-3-1 3" />
        </svg>
        <span className="max-w-full break-words text-center leading-tight">{t("ฝน")}</span>
      </Link>
      <Link href="/map" aria-current={pathname === "/map" ? "page" : undefined} className="nav-tab min-w-0 flex-1 flex-col gap-1 text-foreground"
        style={onMap ? { color: colors.border, backgroundColor: colors.panelBorder } : undefined}>
        <svg aria-hidden="true" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z" />
          <path d="M9 3v15M15 6v15" />
        </svg>
        <span className="max-w-full break-words text-center leading-tight">{t("แผนที่")}</span>
      </Link>
    </nav>
  );
}
