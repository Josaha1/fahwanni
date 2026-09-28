"use client";

import { useFavourites } from "@/hooks/use-favourites";
import { useT } from "@/i18n/client";
import { roundCoord } from "@/lib/geo";
import type { Place } from "@/lib/place";

export function FavouritesRow({ place, onSelect }: { place: Place; onSelect: (place: Place) => void }) {
  const t = useT();
  const { favourites, remove } = useFavourites();
  if (favourites.length === 0) return null;

  return (
    <section aria-label={t("เมืองโปรด")} className="mb-4 min-w-0 max-w-full">
      <div className="flex max-w-full gap-2 overflow-x-auto pb-2" role="list">
        {favourites.slice(0, 8).map((item) => {
          const name = item.source === "gps" ? `${t("ตำแหน่งปัจจุบัน")} ${roundCoord(item.lat).toFixed(2)}, ${roundCoord(item.lon).toFixed(2)}`
            : t.locale === "en" && item.source === "province" ? item.admin ?? item.name : item.name;
          const selected = roundCoord(item.lat) === roundCoord(place.lat) && roundCoord(item.lon) === roundCoord(place.lon);
          return <div key={item.id} role="listitem" className={`flex shrink-0 items-center rounded-xl border ${selected ? "border-given bg-sky" : "border-border bg-card"}`}>
            <button type="button" onClick={() => onSelect(item)} aria-current={selected ? "true" : undefined}
              className={`min-h-11 rounded-l-xl px-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-given ${item.source === "gps" ? "" : "max-w-52"}`}>
              <span className="block whitespace-nowrap">{name}</span>
            </button>
            <button type="button" onClick={() => remove(item.id)} aria-label={`${t("ลบ")} ${name}`}
              className="flex min-h-11 min-w-11 items-center justify-center rounded-r-xl border-l border-border text-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-given">
              <span aria-hidden="true">×</span>
            </button>
          </div>;
        })}
      </div>
    </section>
  );
}
