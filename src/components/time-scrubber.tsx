"use client";

import { useEffect, useMemo, useState } from "react";
import { useT } from "@/i18n/client";
import { sourceTimeMs } from "@/lib/freshness";
import { formatTime } from "@/lib/format";
import { reportedIndex, reportedTimes } from "@/lib/timeline/reported";
import { nextFrameIndex } from "@/lib/radar/frames";

export function TimeScrubber({ days, day, onChange, label, reducedMotion = false, showTime = false, satellite = false }: {
  days: readonly string[]; day: string | null; onChange: (day: string) => void;
  label: string; reducedMotion?: boolean; showTime?: boolean; satellite?: boolean;
}) {
  const t = useT();
  const [playing, setPlaying] = useState(false);
  const [mediaReduced, setMediaReduced] = useState(false);
  const values = useMemo(() => reportedTimes(days), [days]);
  const index = reportedIndex(values, day);
  const selected = values[index];
  const at = sourceTimeMs(selected);
  const date = at === null ? "—" : new Intl.DateTimeFormat(t.intl, {
    day: "numeric", month: "short", timeZone: "Asia/Bangkok",
  }).format(new Date(at));
  const dateLabel = showTime && at !== null ? `${date} · ${formatTime(new Date(at).toISOString(), "Asia/Bangkok", t.locale)}` : date;
  const stopped = reducedMotion || mediaReduced || values.length < 2;
  const replaying = playing && !stopped;
  if (stopped && playing) setPlaying(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => { setMediaReduced(media.matches); if (media.matches) setPlaying(false); };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!replaying) return;
    const stopHidden = () => { if (document.hidden) setPlaying(false); };
    const timer = window.setInterval(() => {
      if (!document.hidden) onChange(values[nextFrameIndex(index, values.length)]);
    }, 900);
    document.addEventListener("visibilitychange", stopHidden);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", stopHidden); };
  }, [replaying, index, values, onChange]);

  return <div className="space-y-1" data-scrub-day={selected ?? ""} data-scrub-index={index} data-scrub-playing={replaying}>
    <p className="text-xs">{label} · {dateLabel}</p>
    {satellite && values.length < 2 ? <p className="text-xs">
      {t("ดาวเทียมมีข้อมูลเพียง {n} วันในสัปดาห์นี้", { n: values.length })}
    </p> : <div className="flex items-center gap-2">
      <button type="button" className="map-play shrink-0 disabled:opacity-50" disabled={stopped}
        aria-label={`${t(replaying ? "หยุดเล่น" : "เล่น")} · ${label}`} aria-pressed={replaying}
        onClick={() => setPlaying((value) => !value)}>{replaying ? "Ⅱ" : "▶"}</button>
      <input type="range" min={0} max={Math.max(0, values.length - 1)} step={1} value={Math.max(0, index)}
        disabled={values.length < 2} aria-label={label} aria-valuetext={dateLabel} className="min-h-11 min-w-0 flex-1"
        onChange={(event) => { const value = values[Number(event.target.value)]; setPlaying(false); if (value) onChange(value); }} />
    </div>}
  </div>;
}
