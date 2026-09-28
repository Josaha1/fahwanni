"use client";

import { useEffect, useRef } from "react";
import { Marker, type Map } from "maplibre-gl";

export function usePlaceMarker(map: Map | null, lon: number, lat: number, label: string, reducedMotion: boolean) {
  const marker = useRef<Marker | null>(null);
  const place = useRef({ lon, lat, label, reducedMotion });
  useEffect(() => { place.current = { lon, lat, label, reducedMotion }; }, [lon, lat, label, reducedMotion]);

  useEffect(() => {
    if (!map) return;
    const currentPlace = place.current;
    const pin = document.createElement("div");
    pin.setAttribute("role", "img");
    pin.setAttribute("aria-label", currentPlace.label);
    pin.className = "neon-pin";
    pin.innerHTML = '<span class="neon-pulse"></span><span class="neon-sweep"></span><span class="neon-core"></span>';
    // Start at the camera centre so the move effect below recentres if the place changed while loading.
    const created = new Marker({ element: pin }).setLngLat(map.getCenter()).addTo(map);
    marker.current = created;
    return () => { created.remove(); marker.current = null; };
  }, [map]);

  useEffect(() => {
    marker.current?.getElement().setAttribute("aria-label", label);
  }, [map, label]);

  useEffect(() => {
    if (!map || !marker.current) return;
    const target: [number, number] = [lon, lat];
    const current = marker.current.getLngLat();
    marker.current.setLngLat(target);
    if (current.lng === lon && current.lat === lat) return;
    if (reducedMotion) map.jumpTo({ center: target });
    else map.easeTo({ center: target, duration: 800 });
  }, [map, lon, lat, reducedMotion]);
}
