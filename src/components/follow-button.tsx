"use client";

import { useWaterWatch } from "@/hooks/use-favourites";
import { useT } from "@/i18n/client";
import type { WatchItem } from "@/lib/water/watchlist";

export function FollowButton({ item }: { item: WatchItem }) {
  const t = useT();
  const { watch, toggle } = useWaterWatch();
  const followed = Object.hasOwn(watch, `${item.kind}:${item.id}`);
  return <button type="button" aria-pressed={followed} onClick={() => toggle(item)}>
    <span aria-hidden="true">{followed ? "★" : "☆"}</span> {t(followed ? "เลิกติดตาม" : "ติดตาม")}
  </button>;
}
