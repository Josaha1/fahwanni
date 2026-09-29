"use client";

import { TZDate } from "@date-fns/tz";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { useT } from "@/i18n/client";
import { formatTime } from "@/lib/format";
import { nextTimeForKey } from "@/lib/timeline/keys";
import { DAY, HOUR, MINUTE, dayLabel, handleLabel, snapStep, timeBadge, type TimeDomain } from "@/lib/timeline/time";

const ZONE = "Asia/Bangkok";

type Translate = ((text: string, params?: Record<string, string | number>) => string) & { locale?: "th" | "en" };

/** Day and month names are Thai keys inside label params, so they are translated before interpolation. */
export function localizeLabel(t: Translate, label: { key: string; params: Record<string, string> }): string {
  const { day, month, ...rest } = label.params;
  return t(label.key, { ...rest, ...(day !== undefined ? { day: t(day) } : {}), ...(month !== undefined ? { month: t(month) } : {}) });
}

/** "พ. 14:37 · พยากรณ์ · ค่าประมาณระหว่างชั่วโมง" — shared by the bar and the point card. */
export function timeLabelText(t: Translate, time: number, domain: TimeDomain,
  { radarTime, primary, lastAvailable, satelliteTime }: { radarTime?: number; primary: "rain" | "temp" | "pm25" | "heat" | "cloud" | "satellite"; lastAvailable?: number; satelliteTime?: string | null }): string {
  if (primary === "satellite") return satelliteTime
    ? t("ภาพดาวเทียม {time} น.", { time: formatTime(satelliteTime, "Asia/Bangkok", t.locale ?? "th") }) : t("ยังไม่ได้โหลด");
  const badge = timeBadge(time, domain, { radarTime, onModelHour: time % HOUR === 0, primary });
  const unavailable = lastAvailable !== undefined && time > lastAvailable;
  return `${localizeLabel(t, handleLabel(time))} · ${unavailable ? t("ไม่มีข้อมูล") : t(badge.key, badge.params as Record<string, string>)}`;
}

export function TimeBar({ domain, t: time, onChange, onTogglePlay, radarStart, radarTime, primary, lastAvailable, satelliteTime, mode }: {
  domain: TimeDomain;
  t: number;
  onChange: (t: number) => void;
  onTogglePlay: () => void;
  radarStart?: number;
  radarTime?: number;
  primary: "rain" | "temp" | "pm25" | "heat" | "cloud" | "satellite";
  lastAvailable?: number;
  satelliteTime?: string | null;
  mode: "fit" | "scroll";
}) {
  const t = useT();
  const viewport = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const scheduled = useRef<number | null>(null);
  const syncing = useRef<number | null>(null);
  const [width, setWidth] = useState(0);
  const duration = domain.end - domain.start;
  const trackWidth = duration / HOUR * 10;
  const position = (value: number) => Math.max(0, Math.min(1, (value - domain.start) / duration));
  const percent = (value: number) => `${position(value) * 100}%`;
  const ticks = useMemo(() => {
    const result: { time: number; day: boolean; hour: string }[] = [];
    const step = mode === "fit" ? 6 * HOUR : 3 * HOUR;
    for (let value = Math.ceil((domain.start + 7 * HOUR) / step) * step - 7 * HOUR; value <= domain.end; value += step) {
      const local = new TZDate(value, ZONE);
      result.push({ time: value, day: local.getHours() === 0, hour: String(local.getHours()).padStart(2, "0") });
    }
    return result;
  }, [domain.start, domain.end, mode]);
  const days = useMemo(() => {
    const result: { start: number; end: number; midnight: number }[] = [];
    const first = new TZDate(domain.start, ZONE);
    let start = domain.start;
    for (let midnight = new TZDate(first.getFullYear(), first.getMonth(), first.getDate() + 1, ZONE).getTime(); start < domain.end; midnight += DAY) {
      const end = Math.min(midnight, domain.end);
      result.push({ start, end, midnight: start === domain.start ? new TZDate(first.getFullYear(), first.getMonth(), first.getDate(), ZONE).getTime() : start });
      start = end;
    }
    return result;
  }, [domain.start, domain.end]);

  useEffect(() => {
    if (mode !== "scroll" || !viewport.current) return;
    const observer = new ResizeObserver(() => setWidth(viewport.current?.clientWidth ?? 0));
    observer.observe(viewport.current);
    return () => observer.disconnect();
  }, [mode]);

  useEffect(() => {
    if (mode !== "scroll" || !viewport.current || !width) return;
    const target = Math.max(0, Math.min(1, (time - domain.start) / duration)) * trackWidth;
    if (Math.abs(viewport.current.scrollLeft - target) < 0.5) return;
    syncing.current = target;
    viewport.current.scrollTo({ left: target, behavior: "auto" });
  }, [time, domain.start, duration, mode, trackWidth, width]);

  useEffect(() => () => { if (scheduled.current !== null) cancelAnimationFrame(scheduled.current); }, []);

  const onScroll = () => {
    if (!viewport.current || scheduled.current !== null) return;
    scheduled.current = requestAnimationFrame(() => {
      scheduled.current = null;
      const left = viewport.current?.scrollLeft;
      if (left === undefined) return;
      if (syncing.current !== null && Math.abs(left - syncing.current) < 1) { syncing.current = null; return; }
      syncing.current = null;
      const next = snapStep(domain.start + left / trackWidth * duration, domain);
      if (next !== time) onChange(next);
    });
  };

  const onPointer = (event: PointerEvent<HTMLDivElement>) => {
    const rect = track.current?.getBoundingClientRect();
    if (!rect) return;
    onChange(snapStep(domain.start + (event.clientX - rect.left) / rect.width * duration, domain));
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === " " || event.key === "Spacebar") {
      event.preventDefault();
      onTogglePlay();
      return;
    }
    const next = nextTimeForKey(event.key, event.shiftKey, time, domain);
    if (next === null) return;
    event.preventDefault();
    if (next !== time) onChange(next);
  };
  const badge = timeBadge(time, domain, { radarTime, onModelHour: time % HOUR === 0, primary });
  const unavailable = lastAvailable !== undefined && time > lastAvailable;
  const label = handleLabel(time);
  const valueText = timeLabelText(t, time, domain, { radarTime, primary, lastAvailable, satelliteTime });
  const slider = {
    role: "slider" as const,
    tabIndex: 0,
    "aria-label": t("เวลาบนแผนที่"),
    "aria-valuemin": 0,
    "aria-valuemax": Math.round(duration / MINUTE),
    "aria-valuenow": Math.round((time - domain.start) / MINUTE),
    "aria-valuetext": valueText,
    onKeyDown,
  };
  const marks = <>
    {radarStart !== undefined && <span className="map-time-radar" style={{ left: percent(radarStart), width: `${Math.max(0, position(domain.now) - position(radarStart)) * 100}%` }} />}
    {lastAvailable !== undefined && lastAvailable < domain.end && <span className="map-time-unavailable" style={{ left: percent(lastAvailable), right: 0 }} />}
    {days.slice(1).map(({ start }) => <span key={start} className="map-time-day" style={{ left: percent(start) }} />)}
    {days.map(({ start, end, midnight }) => {
      const label = dayLabel(midnight);
      return <span key={start} className="map-time-day-segment" style={mode === "fit"
        ? { left: percent(start), width: `${(position(end) - position(start)) * 100}%` }
        : { left: (start - domain.start) / HOUR * 10, width: (end - start) / HOUR * 10 }}>
        <span className="map-time-day-label" title={localizeLabel(t, label)}>
          {mode === "fit" ? <><span className="map-time-day-label-full">{t(label.params.day)} {label.params.date}</span><span className="map-time-day-label-short">{t(label.params.day)}</span></>
            : localizeLabel(t, label)}
        </span>
      </span>;
    })}
    {ticks.map(({ time: value, day, hour }) => <span key={value} className={`map-time-tick${day ? " map-time-tick--day" : ""}`} style={{ left: percent(value) }}>
      <span className="map-time-tick-line" />
      {mode === "scroll" && <span className="map-time-tick-text">{hour}</span>}
    </span>)}
    <span className="map-time-now" style={{ left: percent(domain.now) }} title={t("ตอนนี้")} />
  </>;

  return <div className={`map-time-bar map-time-bar--${mode}`}>
    <div className="map-time-heading">
      <strong>{localizeLabel(t, label)}</strong>
      <small>{primary === "satellite" ? valueText : unavailable ? t("ไม่มีข้อมูล") : t(badge.key, badge.params as Record<string, string>)}</small>
    </div>
    {mode === "fit" ? <div {...slider} ref={track} className="map-time-track" onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); onPointer(event); }} onPointerMove={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) onPointer(event); }}>
      {marks}
      <span className="map-time-handle" style={{ left: percent(time) }}><span /></span>
    </div> : <div className="map-time-scroll-wrap">
      <div {...slider} ref={viewport} className="map-time-viewport" onScroll={onScroll}>
        <div className="map-time-scroll-content" style={{ paddingInline: width / 2 }}>
          <div className="map-time-track" style={{ width: trackWidth }}>{marks}</div>
        </div>
      </div>
      <span className="map-time-center"><span /></span>
    </div>}
  </div>;
}
