"use client";

import { useT } from "@/i18n/client";
import { useLite } from "@/hooks/use-lite";
import { useWaterSource } from "@/hooks/use-water-source";
import { EmergencyStrip } from "@/components/emergency-strip";
import { SourceTime } from "@/components/ui/source-time";
import { MapBackLink } from "@/components/sheet/map-back-link";
import type { DamsPayload } from "@/lib/dams/client";
import type { RiverGauge, RiverSystem } from "@/lib/rivers/types";
import { damRegistryById } from "@/lib/dams/registry";
import { sumRelease } from "@/lib/rivers/observed";
import { RiverSchematic } from "./river-schematic";
import "../dams/dam-detail.css";
import "./river-detail.css";

export type ProvinceGauge = RiverGauge & { provinceId: string; nameEn: string };
const validDams = (value: DamsPayload) => Array.isArray(value?.dams);

export function RiverDetail({ system, gauges }: { system: RiverSystem; gauges: ProvinceGauge[] }) {
  const t = useT();
  const { lite, reducedMotion } = useLite();
  const dams = useWaterSource("/api/dams", validDams);
  const damIds = system.nodes.flatMap((node) => node.damId ? [node.damId] : []);
  // The oldest contributing report dates the shared source line, including API fallback reports.
  const release = sumRelease(damIds, dams.data?.dams ?? [], null);
  const date = release?.today?.date;
  const missingNames = release?.dams.filter((dam) => dam.releaseCms === null).map(({ damId }) => {
    const dam = damRegistryById.get(damId)!;
    return t.locale === "en" ? dam.nameEn : dam.nameTh;
  }) ?? [];
  return <main className="dam-page river-page"><div className="dam-sheet river-sheet">
    <header><MapBackLink /><h1>{t("ลุ่มน้ำ {name}", { name: t.locale === "en" ? system.en : system.th })}</h1></header>
    <p className="river-warning">{t("ตัวเลข = น้ำที่ระบายจากเขื่อน ไม่ใช่น้ำที่วัดในแม่น้ำ · ยังไม่มีระดับน้ำแม่น้ำแบบสด")}</p>
    <SourceTime source="กรมชลประทาน" date={date} kind="daily" className="river-source" />
    {dams.status !== "ready" && <p className="text-muted text-sm" role="status">{t(dams.status === "loading" ? "กำลังโหลดข้อมูลส่วนนี้…" : "ข้อมูลส่วนนี้ไม่พร้อมใช้งาน")}</p>}
    {dams.status === "ready" && missingNames.length > 0 && <p className="river-source">{t("ไม่รายงานวันนี้: {names}", { names: missingNames.join(" · ") })}</p>}
    <div className="river-schematic-scroll"><RiverSchematic system={system} dams={dams.data?.dams ?? []} gauges={gauges} animate={!lite && !reducedMotion} /></div>
    <p className="river-legend">{t("ความกว้างและความเร็วเส้น = ผลรวมการระบายจากเขื่อนต้นน้ำ · ลบ.ม./วินาที · เทาประ = ไม่มีรายงาน · ประยาว = รายงานไม่ครบ")}</p>
    {gauges.length > 0 && <p className="river-source">{t("ขีดเทา = ระดับน้ำรายเดือน HII (CC BY-NC) ไม่ใช่ข้อมูลสด")}</p>}
    <p className="river-source">HydroRIVERS (CC BY 4.0)</p>
    <EmergencyStrip />
  </div></main>;
}
