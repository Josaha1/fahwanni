# Plan: future rain that reads like a forecast, not broken radar

Status: APPROVED (2026-09-29)

## Context
User (2026-09-29): "ทำไมตอนเลื่อนเวลามาอนาคต แล้วรูปฝนแปลกๆ ต้องการให้เหมือนเวลาปกติ".
Verified by Claude:
- t ≤ now → RainViewer radar tiles (~1 km, radar ramp; radar layer paints `raster-saturation 0.35,
  raster-contrast 0.15`, src/components/map/layers/use-radar-layer.ts:21).
- t > now → Open-Meteo 19×19 grid at 1° (≈110 km cells) drawn by `renderRainAt`
  (src/lib/raster/render-at.ts:20) into 256×256, bilinear, 4 hard bins (0.3/1/4/10 mm/h), prob < 30 % dropped,
  alpha = probability. On screen (live, +1 h): 100–300 km pale-cyan blobs with stair-stepped edges; hard jump at now.
- RainViewer `nowcast` = 0 frames (checked live). Radar advection was already spiked and FAILED the gate
  (docs/plans/radar-nowcast.md: advection CSI 0.565 vs persistence 0.567 at +30 min) → not revived.
- No free published-terms source gives convective-cell detail in the future, so "exactly like radar" is not possible;
  the fix is a smooth hand-off + a forecast layer that looks clean and honest.

## Decisions (Fable, checked by Claude)
- **0 → +60 min "blend"**: keep the newest radar frame (persistence) with opacity 0.7 → 0.2 linear over 0–45 min
  (0 after 45 min); model fades in 0 → full over +15 → +60 min. Label: `เรดาร์ล่าสุด (N นาทีก่อน) · กำลังเปลี่ยนเป็นพยากรณ์`.
- **+1 h → +48 h "intensity"**: continuous colour ramp (no hard bins → no stair-steps), matched to the radar layer's
  post-filter colours; draw only prob ≥ 40 %; alpha ramps 0 → 0.6 across 0.3–0.8 mm/h, capped at 0.6 so it never
  reads as radar; rain image 512×512 (256 on deviceMemory < 4).
- **> +48 h "probability"**: no intensity; one hue, 3 steps at 40/60/80 % chance; legend becomes `โอกาสฝน %`.
- Badge whenever not radar: `พยากรณ์จากแบบจำลอง ~100 กม. · ไม่ใช่เรดาร์`.
- No new API calls, no quota change.

## Where Claude differs from / adds to Fable
1. Fable deferred a denser precipitation grid (B-lite: 0.5°, Thailand only, precip+prob, 3 days, 6 h cache,
   ≈2.4k extra Open-Meteo calls/day). Claude agrees to defer it but lists it as an **optional follow-up the user can
   ask for** — it is the only change that makes the *shape* of future rain sharper; C/D only make it cleaner.
2. The rain strip "ฝนที่ตำแหน่งคุณ" (placeSeries) keeps its current thresholds — only the map image changes
   (Fable flagged that changing MIN_PROB globally would change the strip; we keep a separate map constant).

## Tasks (1 Codex dispatch each; Claude verifies diff + Verify + headless)
1. Style mapping (pure): src/lib/precip/render.ts (+ test) — `rainModeAt(leadMs)` → `"blend" | "intensity" |
   "probability"` (blend ≤ 60 min, intensity ≤ 48 h, else probability); `rainRgba(mm, prob, mode)` continuous ramp
   (interpolate between RAIN_RAMP stops adjusted to radar post-filter colours; alpha rules above);
   `probabilityRgba(prob)` 3 steps; map-only constant `MAP_MIN_PROB = 40` (keep MIN_PROB for the strip). Remove
   `renderPrecipImage` + its tests only if grep shows no production caller.
   Verify: `npx vitest run src/lib/precip`
2. Rain source with blend: src/lib/timeline/rain-source.ts (+ test) — for now < t ≤ now + 60 min return
   `{ kind: "blend", index /* newest frame */, frameTime, radarOpacity, modelOpacity }` using the curves above.
   Verify: `npx vitest run src/lib/timeline`
3. Renderer: src/lib/raster/render-at.ts (+ test) — `renderRainAt(series, t, grid, nowMs, width, height, out)`
   picks the mode from lead time; probability mode uses `prob` only; 512 default for rain only.
   Verify: `npx vitest run src/lib/raster --no-file-parallelism`
4. Layer hooks: use-radar-layer.ts takes an `opacity` param (default 0.7); use-time-image-layer.ts takes
   `nowMs` + per-kind size, and drives `raster-opacity` with setPaintProperty (remove `opacity` from the
   useStyleEffect deps so changing it does not tear the layer down); render dedupe key includes the lead bucket.
   Verify: `npm run typecheck && npm run lint && npx vitest run --no-file-parallelism`
5. Wire + UX: map-view.tsx enables both layers in blend with the two opacities; time label per mode
   (src/components/map/ui/time-bar.tsx `timeLabelText`); badge; legend strip/dialog switch to `โอกาสฝน %` in
   probability mode; i18n. Verify: `node scripts/i18n-check.mjs && npx vitest run --no-file-parallelism && npm run build`
6. Claude: headless screenshots at the same spot for now / +20 min / +1 h / +6 h / +3 days (light + dark), colour
   parity check across the now boundary, frame time while scrubbing (512 vs 256), then push + verify:deploy.

## Out of scope
Radar advection/nowcast, denser grid (optional follow-up above), changing the shared 19×19 grid (wind/temp/feels/
3-day accumulation depend on it), paid or no-terms radar sources, Web Worker rendering.

## Risks
- 512×512 encode per scrub step on low-end phones → fallback to 256 (deviceMemory < 4 or 3D on).
- Colour mismatch at the boundary if the post-filter radar colours are not matched → task 6 screenshot check.
- Users may still want cell-level detail in the future; the badge says why it is not there.
