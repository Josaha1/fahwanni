"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/i18n/client";
import { BASE } from "@/lib/map/base-style";
import { useAppMapTheme } from "./map/use-base-style";

export function BottomNav() {
  const pathname = usePathname();
  const t = useT();
  const onMap = pathname === "/map";
  const navRef = useRef<HTMLElement>(null);
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

  return (
    <nav ref={navRef} className="bottom-nav flex gap-2" aria-label={t("นำทางหลัก")}
      style={onMap ? { backgroundColor: colors.bg, borderColor: colors.panelBorder, backdropFilter: "blur(12px)" } : undefined}>
      <Link href="/" aria-current={pathname === "/" ? "page" : undefined} className="nav-tab flex-1 gap-2 text-foreground"
        style={onMap ? { color: colors.label, backgroundColor: "transparent" } : undefined}>
        <svg aria-hidden="true" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 17a5 5 0 0 1 3-9 7 7 0 0 1 13 2 4 4 0 0 1 1 7H3Z" />
          <path d="M8 20h8" />
        </svg>
        {t("พยากรณ์")}
      </Link>
      <Link href="/map" aria-current={pathname === "/map" ? "page" : undefined} className="nav-tab flex-1 gap-2 text-foreground"
        style={onMap ? { color: colors.border, backgroundColor: colors.panelBorder } : undefined}>
        <svg aria-hidden="true" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z" />
          <path d="M9 3v15M15 6v15" />
        </svg>
        {t("แผนที่")}
      </Link>
    </nav>
  );
}
