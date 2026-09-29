# Plan: Windy-style continuous timeline, 7-day forecast

Status: APPROVED (2026-09-29)

## Context
User (2026-09-29): "ต้องการเลื่อนเวลา และพยากรณ์ เป็นนาทีต่อนาทีเหมือน windy เลยได้มั้ย".
Design by Fable (thinker-fable); facts verified by Claude on 2026-09-29.

Verified facts:
- Windy itself has no minute-level model data: its bar is continuous and it interpolates between
  model hours. Minute-level *data* is not available free for Thailand: Open-Meteo `minutely_15`
  answers for Bangkok but (per its docs, to re-check in task 1) outside Central Europe / North
  America the 15-min values are interpolated from hourly → no information gain.
- RainViewer `nowcast` is empty today (`radar.nowcast.length === 0`) → radar stays past-only
  (13 frames available, we use the newest 6 at 10-min steps).
- Open-Meteo forecast `forecast_days=7` → 168 hourly steps; same 1× quota as today (≤ 10 vars,
  ≤ 14 days). Air-quality `forecast_days=7` also returns 168 h.
- Current map: discrete stops, one MapLibre image layer per frame (12 model + 13 temp + 13 PM2.5),
  play every 600 ms; /api/wind 24 h (101 KB), /api/pm25 24 h (37 KB); URL `t` = stop ISO time.

## Decisions
- **"Minute by minute" = continuous scrubbing at 1-minute resolution with interpolation between model
  hours**, clearly labelled. Handle shows "พ. 14:37"; badge underneath: "เรดาร์ 14:30" (past,
  snapped to the real 10-min frame), "พยากรณ์ 15:00" (exactly on a model hour) or
  "พยากรณ์ · ค่าประมาณระหว่างชั่วโมง" (between hours).
- **Horizon 7 days** (past 1 h radar + 7 days model) for rain, temperature, PM2.5 and wind.
- **One upstream fetch, per-day chunks:** `/api/wind?day=N` / `/api/pm25?day=N` (N = 0..6; no
  param = today's current 24 h shape for old clients) slice one cached 7-day upstream result, so
  quota stays at today's cost. Client loads day 0, prefetches 1–2 when idle, lazy-loads others
  when the bar enters that day.
- **Rendering:** one `image` source per scalar variable updated with `updateImage()` when the minute
  changes: lerp the 361 grid values in time, then render with the existing renderer (values are
  interpolated, never colours). Replaces the per-frame layers. Wind: lerp u/v between hours.
  Radar: discrete tile layers, snapped; radar owns t ≤ now, model owns t > now.
- **Bar UI:** bottom bar, linear scale, day labels "พ. 30 ก.ย.", hour ticks, "ตอนนี้" marker
  splitting radar (tinted) and forecast; horizontal scroll on phones; `role="slider"` with
  ←/→ ±10 min, Shift ±1 h, PageUp/PageDown ±1 day, Home = now, End = end, Space = play;
  play speeds 30 / 60 / 120 simulated minutes per second; reduced motion → hourly steps, no blending.
- URL `t` becomes epoch minutes (old ISO `t` still parsed).

## Where Claude disagrees with Fable
1. Radar nowcast task dropped (verified empty).
2. No dev file cache task: the shared Next fetch cache already survives `next start` restarts; the
   7-day upstream (~1.5 MB for wind across 4 chunks, each < 2 MB) still fits it — verify in task 2.

## Tasks (1 Codex dispatch each; Claude verifies diff + Verify + headless Chrome)
1. `src/lib/timeline/time.ts`: domain, `bracket(t, times) → { i, f }`, `lerpGrid`, minute rounding,
   Thai labels + badges (pure, tests). Re-check the Open-Meteo minutely_15 doc note and record it in
   the file comment. Verify: `npx vitest run src/lib/timeline`
2. `/api/wind`: 7-day upstream (`forecast_days=7`) + `?day=N` slicing, default shape unchanged,
   shared cache (+ tests). Verify: vitest + curl day=0..6 each 24 h, two calls → one upstream fetch (log/counter in test)
3. `/api/pm25` same. Verify: vitest + curl
4. Client grid store (`use-forecast-days.ts`): typed arrays per variable, day-chunk lazy loading +
   idle prefetch. Verify: headless — ≤ 3 `/api/wind?day` requests on first paint, +1 after moving to day 4
5. **Spike/refactor:** single image source per scalar (`renderAt(t)` with `updateImage`), remove
   per-frame layers for model rain / temp / PM2.5. Verify: layer count constant; screenshots at
   14:00 / 14:30 / 15:00 differ; render tick p95 < 16 ms at 4× CPU throttle (headless measurement)
6. Wind particles follow interpolated u/v. Verify: unit test on the lerped field + headless screenshot
7. Radar snapping + now seam (radar ≤ now, model > now). Verify: headless at now−5 min shows radar, now+45 min shows model
8. Time bar component (scale, day labels, now marker, handle label, drag, horizontal scroll on phones).
   Verify: headless drag → label changes, no page horizontal scroll at 390 px
9. Keyboard / ARIA / reduced motion. Verify: ArrowRight +10 min, Shift+ArrowRight +1 h, PageDown +1 day (headless)
10. Play with speeds. Verify: headless play 2 s at 60 min/s → t advanced ≈ 120 min
11. Honesty badges + point card / panel values at the scrubbed minute (interpolated, labelled).
    Verify: text assertions at three t values
12. URL `t` in epoch minutes (old ISO parsed), remove stop-based code, full regression, push,
    `npm run verify:deploy https://fahwanni.vercel.app`, live check.

## Risks
- Mobile payload: 7 days ≈ 400 KB gz total → chunking and lazy loading are required.
- Quota: chunks must share one upstream fetch per variable set.
- Seam at "now" (radar vs model disagree) — expected; badge makes the source explicit.
- Big refactor of map-view timeline code that the dam feature also touches → do after dams.

## Out of scope
True minute-level nowcasting (radar extrapolation — our 2026-09 spike failed), model choice
(ECMWF/GFS), > 7 days (beyond 14 days doubles quota).
