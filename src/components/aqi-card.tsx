import { useT } from "@/i18n/client";
import { pm25Level } from "@/lib/air-level";
import type { AirSnapshot } from "@/lib/air";
import { pm25LevelWord } from "@/lib/words";

export function AqiCard({ air }: { air?: AirSnapshot }) {
  const t = useT();
  if (air?.pm25 === undefined) return null;
  const level = pm25Level(air.pm25);

  return (
    <section className={`placeholder-card pm25-${level}`}>
      <h2 className="text-xl">{t("ค่าฝุ่น PM2.5")}</h2>
      <div className="mt-2 flex flex-wrap items-baseline gap-2">
        <strong className="text-5xl leading-tight">{Math.round(air.pm25 * 10) / 10}</strong>
        <span className="text-sm">µg/m³</span>
      </div>
      <p className="mt-1 font-semibold">{pm25LevelWord(level, t)}</p>
      {air.localAqi?.code === "tha_pcd" && (
        <p className="mt-1 text-sm">{t("AQI (ไทย) {aqi} · {category}", {
          aqi: air.localAqi.aqi, category: air.localAqi.category ?? "—",
        })}</p>
      )}
    </section>
  );
}
