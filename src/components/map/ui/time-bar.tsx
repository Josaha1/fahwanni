"use client";

import { TZDate } from "@date-fns/tz";
import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { useT } from "@/i18n/client";
import { DAY, HOUR, dayLabel, handleLabel, snapStep, timeBadge, type TimeDomain } from "@/lib/timeline/time";

const ZONE = "Asia/Bangkok";

export function TimeBar({ domain, t: time, onChange, radarStart, radarTime, primary, lastAvailable, mode }: {
  domain: TimeDomain;
  t: number;
  onChange: (t: number) => void;
  radarStart?: number;
  radarTime?: number;
  primary: "rain" | "temp" | "pm25";
  lastAvailable?: number;
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
    viewport.current.scrollLeft = target;
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
  const badge = timeBadge(time, domain, { radarTime, onModelHour: time % HOUR === 0, primary });
  const unavailable = lastAvailable !== undefined && time > lastAvailable;
  const marks = <>
    {radarStart !== undefined && <span className="map-time-radar" style={{ left: percent(radarStart), width: `${Math.max(0, position(domain.now) - position(radarStart)) * 100}%` }} />}
    {lastAvailable !== undefined && lastAvailable < domain.end && <span className="map-time-unavailable" style={{ left: percent(lastAvailable), right: 0 }} />}
    {days.slice(1).map(({ start }) => <span key={start} className="map-time-day" style={{ left: percent(start) }} />)}
    {days.map(({ start, end, midnight }) => {
      const label = dayLabel(midnight);
      return <span key={start} className="map-time-day-segment" style={mode === "fit"
        ? { left: percent(start), width: `${(position(end) - position(start)) * 100}%` }
        : { left: (start - domain.start) / HOUR * 10, width: (end - start) / HOUR * 10 }}>
        <span className="map-time-day-label" title={t(label.key, label.params)}>
          {mode === "fit" ? <><span className="map-time-day-label-full">{t(label.params.day)} {label.params.date}</span><span className="map-time-day-label-short">{t(label.params.day)}</span></>
            : t(label.key, label.params)}
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
      <strong>{t(handleLabel(time).key, handleLabel(time).params)}</strong>
      <small>{unavailable ? t("ไม่มีข้อมูล") : t(badge.key, badge.params as Record<string, string>)}</small>
    </div>
    {mode === "fit" ? <div ref={track} className="map-time-track" onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); onPointer(event); }} onPointerMove={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) onPointer(event); }}>
      {marks}
      <span className="map-time-handle" style={{ left: percent(time) }}><span /></span>
    </div> : <div className="map-time-scroll-wrap">
      <div ref={viewport} className="map-time-viewport" onScroll={onScroll}>
        <div className="map-time-scroll-content" style={{ paddingInline: width / 2 }}>
          <div className="map-time-track" style={{ width: trackWidth }}>{marks}</div>
        </div>
      </div>
      <span className="map-time-center"><span /></span>
    </div>}
  </div>;
}
