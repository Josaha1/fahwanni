"use client";

import { useState } from "react";
import { useT } from "@/i18n/client";
import { thaiSeason, type SeasonInfo } from "@/lib/season";

const SEASON = { hot: "ฤดูร้อน", rainy: "ฤดูฝน", cool: "ฤดูหนาว" } as const;
const TIP: Record<SeasonInfo["tip"], string> = {
  heatstroke: "ระวังโรคลมแดด ดื่มน้ำบ่อย ๆ",
  umbrella: "พกร่มติดตัวไว้",
  storms: "ช่วงนี้พายุเข้าไทยบ่อย ติดตามประกาศกรมอุตุฯ",
  pm25: "ช่วงนี้ฝุ่น PM2.5 มักสูง",
  "south-monsoon": "มรสุมฝั่งอ่าวไทย ฝนตกหนักได้",
};

/** Thai season (TMD definitions) with one seasonal reminder; only meaningful for places in Thailand. */
export function SeasonChip({ lat, lon }: { lat: number; lon: number }) {
  const t = useT();
  const [now] = useState(() => new Date().toISOString());
  if (lat < 5.5 || lat > 20.5 || lon < 97.3 || lon > 105.7) return null;
  const { season, tip } = thaiSeason(now, lat);
  return (
    <p className="flex flex-wrap items-center gap-2 text-sm">
      <span className="rounded-full bg-sky px-3 py-1 font-semibold text-foreground">{t(SEASON[season])}</span>
      <span className="text-muted">{t(TIP[tip])}</span>
    </p>
  );
}
