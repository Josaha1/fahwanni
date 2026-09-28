"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AdviceStrip } from "@/components/advice-strip";
import { AlertsCard } from "@/components/alerts-card";
import { AqiCard } from "@/components/aqi-card";
import { CurrentCard } from "@/components/current-card";
import { LocationBar } from "@/components/location-bar";
import { SearchBox } from "@/components/search-box";
import { useLastPlace } from "@/hooks/use-favourites";
import { useWeather } from "@/hooks/use-weather";
import { useT } from "@/i18n/client";
import type { Place } from "@/lib/place";

const bangkok: Place = {
  id: "bangkok", name: "กรุงเทพมหานคร", admin: "Bangkok", country: "Thailand",
  lat: 13.75, lon: 100.50, source: "province",
};

export function WeatherApp() {
  const t = useT();
  const { place, setPlace } = useLastPlace();
  const weather = useWeather(place, t.locale);
  const [searchOpen, setSearchOpen] = useState(false);
  const [locating, setLocating] = useState(false);

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
      <h1 className="mb-6 text-3xl">{t("ฟ้าวันนี้")}</h1>
      <LocationBar place={place} locale={t.locale} onSearch={() => setSearchOpen(true)} onGps={useCurrentLocation} locating={locating} />
      {searchOpen && <SearchBox locale={t.locale} onSelect={selectPlace} onClose={() => setSearchOpen(false)} />}
      <div className="space-y-4">
        <CurrentCard weather={weather} />
        {weather.snapshot && <>
          <AqiCard air={weather.air} />
          <AlertsCard alerts={weather.snapshot.alerts} timeZone={weather.snapshot.timeZone} />
          <AdviceStrip snapshot={weather.snapshot} air={weather.air} />
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
