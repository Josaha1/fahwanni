"use client";

import { useMemo } from "react";
import type { Map } from "maplibre-gl";
import { useT } from "@/i18n/client";
import type { Place } from "@/lib/place";
import { distanceKm } from "@/lib/storms/normalize";
import type { HourlySeries } from "@/lib/timeline/store";
import { seriesValueAt } from "@/lib/timeline/values";
import { WIND_BBOX, WIND_NX, WIND_NY } from "@/lib/wind/constants";
import { BASE } from "@/lib/map/base-style";
import { DATA } from "@/lib/map/palette";
import { useMapContext } from "../map-provider";
import { useStyleEffect } from "../use-style-effect";

const SOURCE = "favourites";
const LAYERS = ["favourite-circle", "favourite-rain", "favourite-label"] as const;
const geo = { bbox: WIND_BBOX, nx: WIND_NX, ny: WIND_NY };

export function useFavouriteLayer(map: Map | null, favourites: Place[], place: Place, series: HourlySeries | null, timeMs: number, enabled: boolean) {
  const { theme } = useMapContext();
  const t = useT();
  const data = useMemo(() => ({ type: "FeatureCollection" as const, features: enabled ? favourites.filter((favourite) =>
    distanceKm(favourite, place) >= 1
  ).map((favourite) => {
    const temp = seriesValueAt(series, "temp", timeMs, favourite.lon, favourite.lat, geo);
    const prob = seriesValueAt(series, "prob", timeMs, favourite.lon, favourite.lat, geo);
    const name = t.locale === "en" && favourite.source === "province" ? favourite.admin ?? favourite.name : favourite.name;
    const rain = prob !== null && prob >= 50;
    return { type: "Feature" as const, properties: {
      lat: favourite.lat, lon: favourite.lon, rain: rain ? 1 : 0,
      label: `${name}${temp === null ? "" : ` ${Math.round(temp)}°`}${rain ? ` · ${t("ฝน")}` : ""}`,
    }, geometry: { type: "Point" as const, coordinates: [favourite.lon, favourite.lat] } };
  }) : [] }), [enabled, favourites, place, series, timeMs, t]);

  useStyleEffect(map, (live) => {
    if (!live.getSource(SOURCE) && data.features.length) live.addSource(SOURCE, { type: "geojson", data });
    if (!live.getSource(SOURCE)) return;
    if (!live.getLayer(LAYERS[0])) live.addLayer({ id: LAYERS[0], type: "circle", source: SOURCE, paint: {
      "circle-radius": 5, "circle-color": BASE[theme].bg,
      "circle-stroke-width": 2, "circle-stroke-color": DATA.pin,
    } });
    if (!live.getLayer(LAYERS[1])) live.addLayer({ id: LAYERS[1], type: "circle", source: SOURCE,
      filter: ["==", ["get", "rain"], 1], paint: {
        "circle-radius": 2.5, "circle-color": DATA.pin, "circle-translate": [7, -7],
      } });
    if (!live.getLayer(LAYERS[2])) live.addLayer({ id: LAYERS[2], type: "symbol", source: SOURCE, minzoom: 5,
      layout: { "text-field": ["get", "label"], "text-font": ["Noto Sans Regular"], "text-size": 11, "text-offset": [0, 1.5] },
      paint: { "text-color": BASE[theme].label, "text-halo-color": BASE[theme].halo, "text-halo-width": 1.5 },
    });
  }, (live) => {
    for (const id of LAYERS) if (live.getLayer(id)) live.removeLayer(id);
    if (live.getSource(SOURCE)) live.removeSource(SOURCE);
  }, [data, theme]);
}
