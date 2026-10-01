"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { toast } from "sonner";
import { AdviceStrip } from "@/components/advice-strip";
import { AlertsCard } from "@/components/alerts-card";
import { AqiCard } from "@/components/aqi-card";
import { MarineCard } from "@/components/marine-card";
import { MenuTip } from "@/components/menu-tip";
import { FarmCard } from "@/components/farm-card";
import { LongWeekendCard } from "@/components/long-weekend-card";
import { QuakeCard } from "@/components/quake-card";
import { CurrentCard } from "@/components/current-card";
import { DailyList } from "@/components/daily-list";
import { FavouritesRow } from "@/components/favourites-row";
import { HourlyStrip } from "@/components/hourly-strip";
import { LocationBar } from "@/components/location-bar";
import { OfflineSupport } from "@/components/offline-support";
import { SearchBox } from "@/components/search-box";
import { SeasonChip } from "@/components/season-chip";
import { YesterdayLine } from "@/components/yesterday-line";
import { FavouritesOverview } from "@/components/favourites-overview";
import { BestTimeCard } from "@/components/best-time-card";
import { SpeakButton } from "@/components/speak-button";
import { SettingsSheet } from "@/components/settings-sheet";
import { ShareButton } from "@/components/share-button";
import { SunCard } from "@/components/sun-card";
import { EnsoBadge } from "@/components/enso-badge";
import { AirportCard } from "@/components/airport-card";
import { WebcamsCard } from "@/components/webcams-card";
import { useLastPlace } from "@/hooks/use-favourites";
import { useCurrentLocation } from "@/hooks/use-current-location";
import { useWeather } from "@/hooks/use-weather";
import { useT } from "@/i18n/client";
import type { Place } from "@/lib/place";
import type { RiverStatus } from "@/lib/rivers/types";
import { todayBrief } from "@/lib/today-brief";

const bangkok: Place = {
  id: "bangkok", name: "กรุงเทพมหานคร", admin: "Bangkok", country: "Thailand",
  lat: 13.75, lon: 100.50, source: "province",
};

const StormBanner = dynamic(() => import("@/components/storm-banner").then((module) => module.StormBanner), { ssr: false });
const WaterNearYou = dynamic(() => import("@/components/water-near-you").then((module) => module.WaterNearYou), { ssr: false });

export function WeatherApp() {
  const t = useT();
  const { place, setPlace } = useLastPlace();
  const weather = useWeather(place, t.locale);
  const [searchOpen, setSearchOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [showStormBanner, setShowStormBanner] = useState(false);
  const [water, setWater] = useState<{ lat: number; lon: number; status: RiverStatus | null } | null>(null);
  const onRiverStatus = useCallback((status: RiverStatus | null, lat: number, lon: number) => {
    setWater({ status, lat, lon });
  }, []);
  const brief = todayBrief(weather.snapshot,
    water?.lat === place.lat && water.lon === place.lon ? water.status : null,
    new Date().toISOString(), t);

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

  const { locate, locating } = useCurrentLocation(
    (next) => { setPlace(next); setSearchOpen(false); },
    () => {
      if (place.id === "bangkok") setPlace(bangkok);
      toast.error(t("เข้าถึงตำแหน่งไม่ได้ ลองค้นหาเมืองแทน"));
    },
  );

  return (
    <main className="app-shell">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 id="home-title" className="text-3xl" tabIndex={-1}>{t("ฟ้าวันนี้")}</h1>
        <SettingsSheet />
      </div>
      <MenuTip onClose={() => (document.getElementById("home-today-essentials") ?? document.getElementById("home-title"))?.focus()} />
      <OfflineSupport />
      <LocationBar place={place} locale={t.locale} onSearch={() => setSearchOpen(true)} onGps={locate} locating={locating} />
      <FavouritesRow place={place} onSelect={selectPlace} />
      {searchOpen && <SearchBox locale={t.locale} onSelect={selectPlace} onClose={() => setSearchOpen(false)} />}
      <div className="space-y-4">
        {showStormBanner && <StormBanner place={place} />}
        {(brief.rain || brief.heat || brief.water) && <section className="placeholder-card" aria-label={t("วันนี้ต้องรู้")}>
          <h2 id="home-today-essentials" className="text-xl" tabIndex={-1}>{t("วันนี้ต้องรู้")}</h2>
          <div className="mt-2 space-y-1 text-sm">
            {brief.rain && <p className="truncate" title={brief.rain}>{brief.rain}</p>}
            {brief.heat && <p className="truncate" title={brief.heat}>{brief.heat}</p>}
            {brief.water && <Link href="/water" className="block min-h-11 content-center truncate text-given underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-given" title={brief.water}>{brief.water}</Link>}
          </div>
        </section>}
        <CurrentCard weather={weather} />
        {showStormBanner && <WaterNearYou place={place} onRiverStatus={onRiverStatus} />}
        <SeasonChip lat={place.lat} lon={place.lon} />
        <EnsoBadge compact />
        {weather.snapshot && <YesterdayLine snapshot={weather.snapshot} lat={place.lat} lon={place.lon} />}
        {weather.snapshot && <>
          <div className="flex flex-wrap gap-2">
            <ShareButton snapshot={weather.snapshot} air={weather.air} place={place} />
            <SpeakButton snapshot={weather.snapshot} air={weather.air} place={place} />
          </div>
          <AdviceStrip snapshot={weather.snapshot} air={weather.air} />
          <BestTimeCard snapshot={weather.snapshot} air={weather.air} />
          <HourlyStrip snapshot={weather.snapshot} isDark={isDark} />
          <DailyList snapshot={weather.snapshot} isDark={isDark} />
          <LongWeekendCard snapshot={weather.snapshot} lat={place.lat} lon={place.lon} />
          <AqiCard air={weather.air} />
          <AirportCard lat={place.lat} lon={place.lon} />
          <WebcamsCard lat={place.lat} lon={place.lon} />
          <MarineCard lat={place.lat} lon={place.lon} />
          <FarmCard snapshot={weather.snapshot} lat={place.lat} lon={place.lon} />
          <SunCard snapshot={weather.snapshot} lat={place.lat} lon={place.lon} />
          <AlertsCard alerts={weather.snapshot.alerts} timeZone={weather.snapshot.timeZone} />
          <QuakeCard lat={place.lat} lon={place.lon} />
          <FavouritesOverview current={place} onSelect={selectPlace} isDark={isDark} />
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
