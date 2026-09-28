"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useFavourites } from "@/hooks/use-favourites";
import { useT } from "@/i18n/client";
import type { Locale } from "@/i18n/core";
import type { Place } from "@/lib/place";
import { provinces } from "@/lib/provinces";

const popularIds = ["bangkok", "chiang-mai", "phuket", "khon-kaen", "chon-buri", "songkhla"];
const popular: Place[] = popularIds.map((id) => {
  const province = provinces.find((item) => item.id === id)!;
  return { id, name: province.th, admin: province.en, country: "Thailand", lat: province.lat, lon: province.lon, source: "province" };
});

function placeLabel(place: Place, locale: Locale) {
  return locale === "en" && place.source === "province" ? place.admin ?? place.name : place.name;
}

export function SearchBox({ locale, onSelect, onClose, variant = "card", className }: { locale: Locale; onSelect: (place: Place) => void; onClose: () => void; variant?: "card" | "compact"; className?: string }) {
  const t = useT();
  const { favourites } = useFavourites();
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState<{ query: string; locale: Locale; results: Place[] } | null>(null);
  const [active, setActive] = useState(-1);
  const input = useRef<HTMLInputElement>(null);
  const trimmed = query.trim();
  const currentSearch = search?.query === trimmed && search.locale === locale;
  const results = trimmed ? currentSearch ? search.results : [] : [...favourites, ...popular];
  const searching = Boolean(trimmed && !currentSearch);

  useEffect(() => { input.current?.focus(); }, []);

  useEffect(() => {
    if (!trimmed) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: trimmed, lang: locale });
        const response = await fetch(`/api/geocode?${params}`, { signal: controller.signal });
        if (!response.ok) throw new Error(`Geocode ${response.status}`);
        const data: { results?: Place[] } = await response.json();
        setSearch({ query: trimmed, locale, results: Array.isArray(data.results) ? data.results : [] });
      } catch {
        if (!controller.signal.aborted) setSearch({ query: trimmed, locale, results: [] });
      }
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [trimmed, locale]);

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") { onClose(); return; }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (results.length) setActive((index) => event.key === "ArrowDown"
        ? (index + 1) % results.length : (index < 0 ? results.length - 1 : (index - 1 + results.length) % results.length));
    }
    if (event.key === "Enter" && active >= 0 && results[active]) {
      event.preventDefault();
      onSelect(results[active]);
    }
  }

  return (
    <div className={variant === "compact" ? className : `placeholder-card mb-4${className ? ` ${className}` : ""}`} role="search">
      <div className="flex gap-2">
        <input ref={input} type="search" value={query} onChange={(event) => { setQuery(event.target.value); setActive(-1); }} onKeyDown={onKeyDown}
          placeholder={t("ค้นหาเมืองหรือจังหวัด")} aria-label={t("ค้นหาเมืองหรือจังหวัด")}
          role="combobox" aria-autocomplete="list" aria-expanded="true" aria-controls="place-results"
          aria-activedescendant={active >= 0 && results[active] ? `place-option-${active}` : undefined}
          className={variant === "compact" ? "map-search-input min-w-0 outline-none placeholder:text-muted" : "min-h-12 min-w-0 flex-1 rounded-xl border border-border bg-background px-3 text-foreground outline-none placeholder:text-muted focus-visible:outline-2 focus-visible:outline-given"} />
        <button type="button" onClick={onClose} aria-label={t("ปิดการค้นหา")}
          className={variant === "compact" ? "map-icon-btn shrink-0 text-xl" : "min-h-12 min-w-12 rounded-xl border border-border bg-card text-xl focus-visible:outline-2 focus-visible:outline-given"}>×</button>
      </div>
      <ul id="place-results" role="listbox" aria-label={t("ผลการค้นหา")} className={`mt-2 overflow-y-auto ${variant === "compact" ? "max-h-[50dvh]" : "max-h-80"}`}>
        {results.map((place, index) => (
          <li key={`${place.id}-${index}`} role="presentation">
            {!trimmed && index === 0 && favourites.length > 0 && <p className="px-3 pt-2 text-sm font-semibold text-muted">{t("เมืองโปรด")}</p>}
            {!trimmed && index === favourites.length && <p className="px-3 pt-3 text-sm font-semibold text-muted">{t("จังหวัดยอดนิยม")}</p>}
            <button type="button" id={`place-option-${index}`} role="option" aria-selected={active === index}
              onMouseEnter={() => setActive(index)} onClick={() => onSelect(place)}
              className={`flex min-h-12 w-full flex-col justify-center rounded-xl px-3 py-2 text-left focus-visible:outline-2 focus-visible:outline-given ${variant === "compact" ? "map-search-result" : active === index ? "bg-sky" : "hover:bg-sky"}`}>
              <span className="font-semibold">{placeLabel(place, locale)}</span>
              {(place.admin || place.country) && <span className="text-sm text-muted">{[locale === "en" && place.source === "province" ? place.name : place.admin, place.country === "Thailand" ? t("ประเทศไทย") : place.country].filter(Boolean).join(" · ")}</span>}
            </button>
          </li>
        ))}
      </ul>
      {searching && <p role="status" className="mt-3 text-sm text-muted">{t("กำลังค้นหา...")}</p>}
      {trimmed && !searching && results.length === 0 && <p className="mt-3 text-sm text-muted">{t("ไม่พบสถานที่ ลองพิมพ์ชื่อภาษาอังกฤษ")}</p>}
    </div>
  );
}
