"use client";

import { useEffect, useState } from "react";
import { useT } from "@/i18n/client";
import { formatTime } from "@/lib/format";
import { nearestAirports, type Airport, type AirportObservation } from "@/lib/metar";

const WEATHER = { rain: "ฝนตก", showers: "ฝนตกเป็นช่วง", drizzle: "ฝนปรอย", haze: "ฟ้าหลัว/หมอกควัน", mist: "หมอกบาง", fog: "หมอกหนา", smoke: "ควัน", thunder: "ฝนฟ้าคะนอง" } as const;

/** "ตรวจวัดจริงที่สนามบินใกล้คุณ": the nearest airport's latest METAR (measured, not a model). Hidden when none within 80 km. */
export function AirportCard({ lat, lon }: { lat: number; lon: number }) {
  const t = useT();
  const [state, setState] = useState<{ key: string; airport: Airport; km: number; obs: AirportObservation } | null>(null);
  const key = `${lat},${lon}`;
  useEffect(() => {
    const controller = new AbortController();
    fetch("/data/th-airports.json", { signal: controller.signal }).then((response) => response.json() as Promise<{ airports: Airport[] }>)
      .then(async ({ airports }) => {
        const [nearest] = nearestAirports({ lat, lon }, airports, 80, 1);
        if (!nearest) return;
        const response = await fetch(`/api/metar?ids=${nearest.airport.icao}`, { signal: controller.signal });
        if (!response.ok) return;
        const obs = ((await response.json()) as { items?: AirportObservation[] }).items?.[0];
        if (obs) setState({ key, airport: nearest.airport, km: nearest.km, obs });
      }).catch(() => {});
    return () => controller.abort();
  }, [lat, lon, key]);
  if (!state || state.key !== key) return null;
  const { airport, km, obs } = state;
  const name = t.locale === "en" ? airport.name : t("สนามบิน{name}", { name: airport.nameTh });
  return <section className="placeholder-card space-y-2" aria-label={t("ตรวจวัดจริงที่สนามบินใกล้คุณ")}>
    <h2 className="text-lg font-semibold">{t("ตรวจวัดจริงที่สนามบินใกล้คุณ")}</h2>
    <p className="text-muted text-sm">{t("{name} · ห่าง {km} กม. · วัดเมื่อ {time} น.", { name, km: Math.round(km), time: formatTime(obs.observedAt, "Asia/Bangkok", t.locale) })}</p>
    {obs.storm && <p className="map-warning font-semibold"><span aria-hidden="true">⚡ </span>{t("มีเมฆฝนฟ้าคะนองใกล้สนามบิน")}</p>}
    <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
      {obs.tempC !== null && <><dt className="text-muted">{t("อุณหภูมิ")}</dt><dd className="font-semibold">{obs.tempC}°C</dd></>}
      {obs.humidity !== null && <><dt className="text-muted">{t("ความชื้น")}</dt><dd className="font-semibold">{obs.humidity}%</dd></>}
      {obs.windKmh !== null && <><dt className="text-muted">{t("ลม")}</dt><dd className="font-semibold">{obs.windKmh} km/h{obs.gustKmh ? ` (${t("กระโชก {n}", { n: obs.gustKmh })})` : ""}</dd></>}
      {obs.visibilityKm !== null && <><dt className="text-muted">{t("ทัศนวิสัย")}</dt><dd className="font-semibold">{obs.visibilityKm >= 10 ? t("10 กม. ขึ้นไป") : t("{km} กม.", { km: obs.visibilityKm })}</dd></>}
    </dl>
    {obs.weather.length > 0 && <p className="text-sm">{obs.weather.map((code) => t(WEATHER[code])).join(" · ")}</p>}
    <p className="text-muted text-xs">{t("ค่าวัดจริงจากรายงาน METAR ไม่ใช่แบบจำลอง · ที่มา aviationweather.gov (NOAA)")}</p>
  </section>;
}
