"use client";

import { useState } from "react";
import type { Place } from "@/lib/place";

export function useCurrentLocation(onPlace: (place: Place) => void, onError: () => void): { locate: () => void; locating: boolean } {
  const [locating, setLocating] = useState(false);

  function locate() {
    if (locating) return;
    if (!navigator.geolocation) { onError(); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        onPlace({ id: "gps", name: "ตำแหน่งปัจจุบัน", lat: coords.latitude, lon: coords.longitude, source: "gps" });
        setLocating(false);
      },
      () => { onError(); setLocating(false); },
      { timeout: 10_000, maximumAge: 600_000 },
    );
  }

  return { locate, locating };
}
