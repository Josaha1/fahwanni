"use client";

import { useEffect, useRef } from "react";
import { Marker, type Map } from "maplibre-gl";
import { useStyleEffect } from "../use-style-effect";

export function usePlaceMarker(map: Map | null, lon: number, lat: number, label: string, reducedMotion: boolean) {
  const marker = useRef<Marker | null>(null);
  const place = useRef({ lon, lat, label, reducedMotion });
  useEffect(() => { place.current = { lon, lat, label, reducedMotion }; }, [lon, lat, label, reducedMotion]);

  useStyleEffect(map, (live) => {
    if (marker.current) return;
    const currentPlace = place.current;
    const pin = document.createElement("div");
    pin.setAttribute("role", "img");
    pin.setAttribute("aria-label", currentPlace.label);
    pin.className = "neon-pin";
    pin.innerHTML = '<span class="neon-pulse"></span><span class="neon-sweep"></span><span class="neon-core"></span>';
    const created = new Marker({ element: pin }).setLngLat(live.getCenter()).addTo(live);
    marker.current = created;
    const target: [number, number] = [currentPlace.lon, currentPlace.lat];
    const current = created.getLngLat();
    created.setLngLat(target);
    if (current.lng === target[0] && current.lat === target[1]) return;
    if (currentPlace.reducedMotion) live.jumpTo({ center: target });
    else live.easeTo({ center: target, duration: 800 });
  }, () => { marker.current?.remove(); marker.current = null; }, []);

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
