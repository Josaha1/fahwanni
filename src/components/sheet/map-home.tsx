"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useLite } from "@/hooks/use-lite";
import { useLastPlace } from "@/hooks/use-favourites";
import { useWaterSource } from "@/hooks/use-water-source";
import { useT } from "@/i18n/client";
import { MapSearchPill } from "@/components/map/ui/map-search-pill";
import { SourceTime } from "@/components/ui/source-time";
import { ThMap } from "@/components/visuals/th-map";
import { FavouritesRow } from "@/components/favourites-row";
import { TmdWarningList } from "@/components/water/tmd-warnings";
import { FloodEventItem, type FloodEventsPayload } from "@/components/water/flood-events";
import { recentFloodEvents, type FloodNowPayload } from "@/components/flood/home-data";
import { provinces } from "@/lib/provinces";
import type { PixelCounts } from "@/lib/flood/viirs";
import type { DamsPayload } from "@/lib/dams/client";
import type { RainRisk } from "@/lib/rain-risk/tmd";
import type { TmdWarnings } from "@/lib/tmd";
import { BottomSheet } from "./bottom-sheet";
import type { Detent } from "./detents";
import { cloudPercent, damClipboard, number, waterPoints } from "./home-data";
import { useHomeNews } from "./use-home-news";
import "./map-home.css";

const MapView = dynamic(() => import("@/components/map/map-view").then((module) => module.MapView), { ssr: false });
type NearFlood = FloodNowPayload & { nearMe?: { counts: PixelCounts } };
const validFlood = (data: NearFlood) => typeof data?.date === "string" && !!data.provinceCounts;
const validDams = (data: DamsPayload) => Array.isArray(data?.dams);
const validRain = (data: RainRisk) => Array.isArray(data?.all);
const validWarnings = (data: TmdWarnings & { error?: string }) => Array.isArray(data?.items) && !data.error;
const validEvents = (data: FloodEventsPayload) => Array.isArray(data?.items);
const noDams: NonNullable<DamsPayload["dams"]> = [];

export function MapHome() {
  const { lite, reducedMotion } = useLite();
  const fallback = lite || reducedMotion;
  // Resolve the device gate before mounting the dynamically imported WebGL map.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { queueMicrotask(() => setMounted(true)); }, []);
  return <HomeContent fallback={mounted && fallback} mounted={mounted} />;
}

export function HomeContent({ fallback, mounted }: { fallback: boolean; mounted: boolean }) {
  const t = useT();
  const { place, setPlace } = useLastPlace();
  const [lens, setLens] = useState<"flood" | "dams" | "rain">("flood");
  const [detent, setDetent] = useState<Detent>(() => fallback ? "half" : "peek");
  const [wasFallback, setWasFallback] = useState(fallback);
  if (wasFallback !== fallback) { setWasFallback(fallback); if (fallback) setDetent("half"); }
  const flood = useWaterSource(`/api/flood-now?lat=${place.lat}&lon=${place.lon}`, validFlood);
  const dams = useWaterSource("/api/dams", validDams);
  const rain = useWaterSource("/api/rain-risk", validRain);
  const warnings = useWaterSource("/api/tmd-warnings", validWarnings);
  const events = useWaterSource("/api/flood-events", validEvents);
  const damList = dams.data?.dams ?? noDams;
  const { news, items, watch, markRead } = useHomeNews(damList, lens === "rain");
  const dialog = useRef<HTMLDialogElement>(null);
  const bell = useRef<HTMLButtonElement>(null);
  const highRelease = damList.filter((dam) => dam.releaseCms !== null && dam.releaseCms >= 100);
  const [nowMs] = useState(() => Date.now());
  const recent = recentFloodEvents(events.data?.items ?? [], nowMs);
  const alertCount = highRelease.length + recent.length + (warnings.data?.items.length ?? 0);
  const flooded = Object.entries(flood.data?.provinceCounts ?? {}).filter(([, counts]) => waterPoints(counts) > 0)
    .sort((a, b) => waterPoints(b[1]) - waterPoints(a[1]));
  const rainList = [...(rain.data?.all ?? [])].sort((a, b) => b.rainMm - a.rainMm);
  const releaseList = [...damList].sort((a, b) => (b.releaseCms ?? -1) - (a.releaseCms ?? -1));
  const tableList = [...damList].sort((a, b) => b.storagePct - a.storagePct);
  const near = flood.data?.nearMe?.counts;
  const warningTime = warnings.data?.items.length ? warnings.data.items[0].announcedAt : warnings.loadedAt;
  const source = (name: string, date: string | null | undefined, kind: "daily" | "satellite" | "rain24h" = "daily") =>
    <SourceTime source={name} date={date} kind={kind} className="home-source" />;
  const provinceName = (id: string) => { const province = provinces.find((item) => item.id === id); return province ? t.locale === "en" ? province.en : province.th : id; };
  const selectProvince = (id: string) => {
    const province = provinces.find((item) => item.id === id);
    if (province) setPlace({ ...place, id, name: province.th, admin: province.en, lat: province.lat, lon: province.lon, source: "province" });
    setDetent("half");
    window.history.replaceState(null, "", `/?province=${encodeURIComponent(id)}`);
  };
  useEffect(() => {
    const update = () => {
      const id = new URLSearchParams(window.location.search).get("province");
      const province = provinces.find((item) => item.id === id);
      if (province) { setPlace({ id: province.id, name: province.th, admin: province.en, lat: province.lat, lon: province.lon, source: "province", country: "Thailand" }); setDetent("half"); }
    };
    update();
    window.addEventListener("popstate", update);
    return () => window.removeEventListener("popstate", update);
    // URL selection is read on navigation; place changes do not reapply an old query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const loading = t("ข้อมูลส่วนนี้ไม่พร้อมใช้งาน");
  return <main className="map-home" data-lite={fallback}>
    <h1 className="sr-only">{t("สถานการณ์น้ำท่วมตอนนี้")}</h1>
    {fallback ? <div className="home-svg"><ThMap counts={flood.data?.provinceCounts ?? null} samples={flood.data?.samples ?? []} affected={[]} warnedRegions={[]} onSelect={selectProvince} /></div>
      : mounted && <MapView homeLens={lens} />}
    <header className="home-top">
      <div className="home-search"><MapSearchPill placeName={t.locale === "en" ? place.admin ?? place.name : place.name} />
        <button ref={bell} className="home-bell" aria-label={t("แจ้งเตือน {n} รายการ", { n: alertCount })} aria-haspopup="dialog" onClick={() => dialog.current?.showModal()}>
          <svg aria-hidden="true" width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M5 17h14l-2-4V9a5 5 0 0 0-10 0v4l-2 4Zm5 3h4" /></svg>
          <b>{alertCount}</b>{news.length > 0 && <i aria-label={t("มีข้อมูลใหม่")} />}
        </button>
      </div>
      <div className="home-lenses" role="group" aria-label={t("ชั้นข้อมูล")}>
        {([ ["flood", "ท่วม"], ["dams", "เขื่อน"], ["rain", "ฝน"] ] as const).map(([key, label]) => <button key={key} aria-pressed={lens === key} onClick={() => setLens(key)}>{t(label)}</button>)}
        <span className="home-clock">{source("NASA VIIRS", flood.data?.date, "satellite")}</span>
      </div>
    </header>
    <div className="home-legend"><span><i className="water" />{t("ดาวเทียมพบน้ำ")}</span><span><i className="release" />{t("ระบาย / ความจุ > 80%")}</span><span><i className="cloud" />{t("เมฆ / ไม่มีรายงาน")}</span></div>
    <BottomSheet detent={detent} onChange={setDetent} reducedMotion={fallback}>
      <div className="home-status" aria-live="polite"><span className="water">{t("ดาวเทียมพบน้ำ {n} จังหวัด", { n: flood.data ? flooded.length : "—" })}</span><span className="release">{t("{n} เขื่อน > 80%", { n: dams.data ? damList.filter((dam) => dam.storagePct > 80).length : "—" })}</span></div>
      <div className="home-status-sources">{source("NASA VIIRS", flood.data?.date, "satellite")}{source("กรมชลประทาน", dams.data?.dataDate)}</div>
      <div className="home-tiles">
        <button className="home-tile" onClick={() => setDetent("half")}><span>{t("ใกล้ฉัน")} · {place.name}</span><strong>{t("พบน้ำ {n} จุด", { n: near && near.sampled > near.noData + near.insufficientData ? number(waterPoints(near)) : "—" })}</strong><small>{t("เมฆ {n}%", { n: number(cloudPercent(near)) })}</small>{source("NASA VIIRS", flood.data?.date, "satellite")}</button>
        <button className="home-tile" onClick={() => dialog.current?.showModal()}><span>{t("ประกาศเตือน")}</span><strong>{warnings.data ? warnings.data.items.length ? t("{n} ประกาศ", { n: warnings.data.items.length }) : t("ไม่มีประกาศเตือนภัย") : "—"}</strong>{source("กรมอุตุนิยมวิทยา", warningTime)}</button>
        <button className="home-tile" onClick={() => { setLens("rain"); setDetent("half"); }}><span>{t("ฝน 24 ชม.")}</span><strong>{rainList[0] ? `${number(rainList[0].rainMm)} ${t("มม.")}` : "—"}</strong><small>{rainList[0]?.nameTh}</small>{source("กรมอุตุนิยมวิทยา", rain.data?.observedAt, "rain24h")}</button>
      </div>
      {detent !== "peek" && <>
        <h2>{t(lens === "dams" ? "เขื่อนที่ระบายมากสุด" : lens === "rain" ? "ฝนมากสุด 24 ชม." : "จังหวัดที่ดาวเทียมพบน้ำ")}</h2>
        <div className="home-rows">
          {lens === "flood" && flooded.slice(0, 10).map(([id, counts]) => <Link key={id} href={`/?province=${id}`} onClick={(event) => { event.preventDefault(); selectProvince(id); }} className="home-row" aria-current={place.id === id ? "true" : undefined}>
            <span>{provinceName(id)}</span><span className="home-bar"><i style={{ width: `${100 * waterPoints(counts) / Math.max(1, waterPoints(flooded[0][1]))}%` }} /></span><span>{t("{n} จุด", { n: number(waterPoints(counts)) })}<small>{t("เมฆ {n}%", { n: number(cloudPercent(counts)) })}</small></span></Link>)}
          {lens === "dams" && releaseList.slice(0, 10).map((dam) => <Link key={dam.id} href={`/water/dam/${dam.id}`} className="home-row"><span>{dam.nameTh}</span><span className="home-bar release"><i style={{ width: `${Math.min(100, dam.storagePct)}%` }} /></span><span>{number(dam.storagePct)}%<small>{number(dam.releaseCms)} {t("ลบ.ม./วิ")}</small></span></Link>)}
          {lens === "rain" && rainList.slice(0, 10).map((station) => <Link key={station.id} href="/rain" className="home-row"><span>{station.nameTh}</span><span className="home-bar"><i style={{ width: `${100 * station.rainMm / Math.max(1, rainList[0].rainMm)}%` }} /></span><span>{number(station.rainMm)} {t("มม.")}</span></Link>)}
        </div>
        {lens === "flood" && <p className="home-source">{t("จุดตรวจจากดาวเทียม ไม่ใช่ขนาดพื้นที่")} · {source("NASA VIIRS", flood.data?.date, "satellite")}{!flood.data && ` · ${loading}`}</p>}
        {lens === "dams" && <p className="home-source">{source("กรมชลประทาน", dams.data?.dataDate)}</p>}
        {lens === "rain" && <p className="home-source">{source("กรมอุตุนิยมวิทยา", rain.data?.observedAt, "rain24h")}</p>}
        {lens === "dams" && !dams.data && <p role="status">{loading}</p>}{lens === "rain" && !rain.data && <p role="status">{loading}</p>}
      </>}
      {detent === "full" && <>
        <h2>{t("ตารางเขื่อนทั้งหมด (เจ้าหน้าที่/สื่อ)")}</h2>
        <div className="home-table"><table><thead><tr>{["เขื่อน", "%", "ล้าน ม³", "เข้า", "ระบาย"].map((label) => <th key={label} scope="col">{t(label)}</th>)}</tr></thead><tbody>{tableList.map((dam) => <tr key={dam.id}><th scope="row"><Link href={`/water/dam/${dam.id}`}>{dam.nameTh}</Link><br />{source("กรมชลประทาน", dam.date)}</th><td>{number(dam.storagePct)}</td><td>{number(dam.storageMcm)}</td><td>{number(dam.inflowCms)}</td><td>{number(dam.releaseCms)}</td></tr>)}</tbody></table></div>
        <p className="home-source">{t("เข้า / ระบาย: ลบ.ม./วินาที · — = ไม่รายงาน")}</p>
        <button className="home-action" disabled={!dams.data} onClick={async () => { try { await navigator.clipboard.writeText(damClipboard(tableList)); toast.success(t("คัดลอกแล้ว")); } catch { toast.error(t("คัดลอกไม่สำเร็จ")); } }}>{t("คัดลอกพร้อมที่มา")}</button>
      </>}
      <div className="home-depth" role="group" aria-label={t("ระดับรายละเอียด")}><span>{t("ดูแบบ")}</span>{([ ["peek", "ทั่วไป"], ["half", "อาสา"], ["full", "เจ้าหน้าที่"] ] as const).map(([key, label]) => <button key={key} aria-pressed={detent === key} onClick={() => setDetent(key)}>{t(label)}</button>)}</div>
      <div className="home-emergency" aria-label={t("เบอร์ฉุกเฉิน")}>{[["1784", "ปภ. 1784"], ["1669", "เจ็บป่วย 1669"], ["191", "เหตุด่วน 191"]].map(([phone, label]) => <a href={`tel:${phone}`} key={phone}>{t(label)}</a>)}</div>
    </BottomSheet>
    <dialog ref={dialog} className="home-alerts" aria-labelledby="home-alerts-title" onClose={() => { markRead(); bell.current?.focus(); }}>
      <header><h2 id="home-alerts-title">{t("แจ้งเตือน")}</h2><button onClick={() => dialog.current?.close()} aria-label={t("ปิด")}>×</button></header>
      <div className="home-alerts-body">
        {warnings.data ? <>{warnings.data.items.length ? <TmdWarningList items={warnings.data.items} limit={warnings.data.items.length} /> : <p>{t("ไม่มีประกาศเตือนภัย")}</p>}{source("กรมอุตุนิยมวิทยา", warningTime)}</> : <p>{loading}</p>}
        {highRelease.map((dam) => <Link className="home-alert-row" href={`/water/dam/${dam.id}`} key={dam.id}>{dam.nameTh} · {t("ระบาย")} {number(dam.releaseCms)} {t("ลบ.ม./วิ")}{source("กรมชลประทาน", dam.date)}</Link>)}
        {recent.map((event) => <FloodEventItem key={event.id} event={event} muted="home-source" />)}
        {source("GLIDE / GDACS", events.data?.fetchedAt)}
        <h3>{t("มีอะไรใหม่")}</h3>{news.map((entry) => <p key={entry.key}>{t(entry.text, entry.params)}{source(entry.key.startsWith("dam:") ? "กรมชลประทาน" : "GloFAS / RID / HII", items.find((item) => item.key === entry.key)?.date)}</p>)}
        <h3>{t("ติดตาม")}</h3>{Object.keys(watch).map((key) => <Link className="home-alert-row" key={key} href={key.startsWith("dam:") ? `/water/dam/${key.slice(4)}` : `/map?river=${key.slice(6)}`}>{items.find((item) => item.key === key)?.label ?? key}{source(key.startsWith("dam:") ? "กรมชลประทาน" : "GloFAS / RID / HII", items.find((item) => item.key === key)?.date ?? watch[key as keyof typeof watch].date)}</Link>)}
        <FavouritesRow place={place} onSelect={(next) => { setPlace(next); dialog.current?.close(); }} />
      </div>
    </dialog>
  </main>;
}
