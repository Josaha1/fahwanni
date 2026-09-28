"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { AdviceStrip } from "@/components/advice-strip";
import { AlertsCard } from "@/components/alerts-card";
import { AqiCard } from "@/components/aqi-card";
import { CurrentCard } from "@/components/current-card";
import { DailyList } from "@/components/daily-list";
import { FavouritesRow } from "@/components/favourites-row";
import { HourlyStrip } from "@/components/hourly-strip";
import { LocationBar } from "@/components/location-bar";
import { OfflineSupport } from "@/components/offline-support";
import { SearchBox } from "@/components/search-box";
import { SeasonChip } from "@/components/season-chip";
import { SettingsSheet } from "@/components/settings-sheet";
import { ShareButton } from "@/components/share-button";
import { SunCard } from "@/components/sun-card";
import { useLastPlace } from "@/hooks/use-favourites";
import { useWeather } from "@/hooks/use-weather";
import { useT } from "@/i18n/client";
import type { Place } from "@/lib/place";

const bangkok: Place = {
  id: "bangkok", name: "กรุงเทพมหานคร", admin: "Bangkok", country: "Thailand",
  lat: 13.75, lon: 100.50, source: "province",
};

const StormBanner = dynamic(() => import("@/components/storm-banner").then((module) => module.StormBanner), { ssr: false });

export function WeatherApp() {
  const t = useT();
  const { place, setPlace } = useLastPlace();
  const weather = useWeather(place, t.locale);
  const [searchOpen, setSearchOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [showStormBanner, setShowStormBanner] = useState(false);

  useEffect(() => {
    let timer: number;
    const frame = window.requestAnimationFrame(() => { timer = window.setTimeout(() => setShowStormBanner(true), 0); });
    return () => { window.cancelAnimationFrame(frame); window.clearTimeout(timer); };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const update = () => setIsDark(root.dataset.theme === "dark" || root.dataset.theme === "night");
    update();
    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  function selectPlace(next: Place) {
    setPlace(next);
    setSearchOpen(false);
  }

  function useCurrentLocation() {
    if (locating) return;
    if (!navigator.geolocation) {
      if (place.id === "bangkok") setPlace(bangkok);
      toast.error(t("เข้าถึงตำแหน่งไม่ได้ ลองค้นหาเมืองแทน"));
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setPlace({
          id: "gps", name: "ตำแหน่งปัจจุบัน", lat: coords.latitude,
          lon: coords.longitude, source: "gps",
        });
        setSearchOpen(false);
        setLocating(false);
      },
      () => {
        if (place.id === "bangkok") setPlace(bangkok);
        toast.error(t("เข้าถึงตำแหน่งไม่ได้ ลองค้นหาเมืองแทน"));
        setLocating(false);
      },
      { timeout: 10_000, maximumAge: 600_000 },
    );
  }

  return (
    <main className="app-shell">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-3xl">{t("ฟ้าวันนี้")}</h1>
        <SettingsSheet />
      </div>
      <OfflineSupport />
      <LocationBar place={place} locale={t.locale} onSearch={() => setSearchOpen(true)} onGps={useCurrentLocation} locating={locating} />
      <FavouritesRow place={place} onSelect={selectPlace} />
      {searchOpen && <SearchBox locale={t.locale} onSelect={selectPlace} onClose={() => setSearchOpen(false)} />}
      <div className="space-y-4">
        {showStormBanner && <StormBanner place={place} />}
        <CurrentCard weather={weather} />
        <SeasonChip lat={place.lat} lon={place.lon} />
        {weather.snapshot && <>
          <ShareButton snapshot={weather.snapshot} air={weather.air} place={place} />
          <AdviceStrip snapshot={weather.snapshot} air={weather.air} />
          <HourlyStrip snapshot={weather.snapshot} isDark={isDark} />
          <DailyList snapshot={weather.snapshot} isDark={isDark} />
          <AqiCard air={weather.air} />
          <SunCard snapshot={weather.snapshot} />
          <AlertsCard alerts={weather.snapshot.alerts} timeZone={weather.snapshot.timeZone} />
        </>}
      </div>
      <section aria-label={t("เบอร์ฉุกเฉิน")} className="mt-8 border-t border-border pt-4">
        <h2 className="text-base">{t("เบอร์ฉุกเฉิน")}</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          <a href="tel:1784" className="flex min-h-11 items-center rounded-xl border border-border bg-card px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-given">{t("ปภ.")} 1784</a>
          <a href="tel:1182" className="flex min-h-11 items-center rounded-xl border border-border bg-card px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-given">{t("กรมอุตุฯ")} 1182</a>
          <a href="tel:1669" className="flex min-h-11 items-center rounded-xl border border-border bg-card px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-given">{t("เจ็บป่วยฉุกเฉิน")} 1669</a>
        </div>
      </section>
    </main>
  );
}
