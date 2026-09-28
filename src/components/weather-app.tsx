"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CurrentPlaceholder } from "@/components/current-placeholder";
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
      <CurrentPlaceholder place={place} locale={t.locale} weather={weather} />
    </main>
  );
}
