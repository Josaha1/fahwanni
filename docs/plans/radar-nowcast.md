# Plan: future radar — nowcast (+10–60 min) and model rain (+1–12 h)

Status: PARTIAL — spike FAILED 2026-09-28; nowcast A cut, B + timeline continue in docs/plans/neon-and-deploy.md (tasks 2–6)

## Context
User: "ทำเรดาให้พยากรณ์ไปเป็นเวลาข้างหน้าด้วยได้มั้ย" → chose A + B. RainViewer's free API has
0 nowcast frames (verified), so both future segments are ours. Design by Fable (thinker-fable),
facts re-checked by Claude 2026-09-28.

## Decisions
- **One timeline** on the existing scrubber: past radar (6 frames) → **A nowcast** +10…+60 min
  (6 frames, label "คาดการณ์") → **B model** +1…+12 h (12 frames, label "แบบจำลอง"). A 3-colour
  segment bar under the slider. Autoplay loops radar+nowcast only; model is scrub-only.
- **A (browser)**: RainViewer **z5** tiles **x24–25, y14–15** (lon 90–112.5°E, lat 0–21.94°N,
  512×512 px ≈ 4.8 km/px) for the 4 newest frames; RGBA → intensity levels; one global motion
  vector by block matching (256² downsample, 32² blocks, ±6 px, SAD + sub-pixel, rain-weighted
  median), dt from real timestamps; confidence from a second vector (t-20→t-10); semi-Lagrangian
  advection of t0 for τ = 10…60 min with fade (→50 %) and blur (0→2 px); painted in the radar's
  scheme-2 colours; 6 MapLibre `ImageSource`s (`nowcast-0..5`) fed via `updateImage`.
  Main thread in v1 (no Worker). Skipped entirely when `saveData`.
- **B (server, free)**: add `precipitation,precipitation_probability` to the **existing** `/api/wind`
  Open-Meteo request (same 361 points, same 3-h refresh → no extra quota; a separate grid would
  add ~8.7k calls/day and break the 10k/day cap). 12 hourly steps from now. Client renders 12
  `ImageSource`s (`model-0..11`) over the wind bbox with Mercator-correct rows, radar legend bins,
  alpha from probability so it reads as an outlook, not radar. `precip` optional in the type
  (CDN may serve the old shape for up to 3 h after deploy).
- **Arrival ETA** from A: back-trajectory from the place along the motion vector, τ = 5…60 min,
  hit = rain within ~6 km; subtract frame age; always hedged ("น่าจะ", "(ไม่แน่นอน)" when vectors
  disagree); never claim "no rain", say "ยังไม่เห็นฝนที่จะมาถึงภายใน 1 ชม.".
- All new layers use the existing idle re-apply + theme `setStyle` cleanup pattern in map-view.

## Where Claude disagrees with Fable
- Fable said z5 rows **y15–16** cover 0–21.9°N. Computed: y15–16 = **11.2°N to 11.2°S**.
  Correct rows for Thailand are **y14–15** (0–21.94°N). Fixed above.

## Tasks (sequential; Codex while quota lasts, else Claude)
1. **Pure nowcast lib** `src/lib/nowcast/{intensity,motion,advect,score}.ts` + tests (relative
   imports only). Synthetic blob shifted (3,−2) → motion within ±0.5 px; advect moves blob by v·τ;
   CSI/POD/FAR on a hand case. Verify: `npx vitest run src/lib/nowcast`
2. **SPIKE hindcast** `scripts/nowcast-spike.ts` (sharp, live RainViewer z5 y14–15): motion from
   t-90→t-60, advect t-60 to +30/+60, score vs actual t-30/t0, print CSI/POD/FAR for advection vs
   persistence and rain coverage. Verify: `node scripts/nowcast-spike.ts` — gate: CSI_adv ≥
   CSI_persist at +30 when coverage ≥ 3 % (else INCONCLUSIVE → rerun later). **Fail → drop tasks
   7–9, ship B + timeline only.**
3. **B data**: extend `src/lib/wind/{client,grid}.ts` + fixture + tests with `precipHours`,
   `precip`, `prob` (12 h, 361 pts). Verify: `npx vitest run src/lib/wind` + live
   `curl -s localhost:3000/api/wind` shows `12 12 361`.
4. **B render (pure)** `src/lib/precip/render.ts` + test (size, colour bins, Mercator rows, alpha).
   Verify: `npx vitest run src/lib/precip`
5. **Timeline (pure)** `src/lib/timeline/frames.ts` + test (`buildTimeline`, play loop, labels).
   Verify: `npx vitest run src/lib/timeline`
6. **Map: model layers + unified scrubber** in `map-view.tsx`. Verify: typecheck/lint + Claude in
   Chrome (scrub to +3 ชม. shows rain; theme switch re-adds layers).
7. **Nowcast hook** `src/components/map/use-nowcast.ts` (z5 tiles, 4 frames, returns frames,
   vector, confidence, computeMs). Verify: Chrome — computeMs < 300 ms desktop, no tile errors.
8. **Map: nowcast layers** wired into the timeline. Verify: typecheck + Chrome.
9. **Arrival ETA** `src/lib/nowcast/arrival.ts` + test + panel line. Verify: `npx vitest run src/lib/nowcast`
10. **i18n + README/sources**. Verify: `node scripts/i18n-check.mjs && npm run check:sources && npx vitest run && npm run build`

### Additions (user picked from Claude's suggestions)
11. **"ฝนที่ตำแหน่งคุณ" strip**: pure `src/lib/nowcast/place-series.ts` (intensity at the place per
    timeline stop: radar → nowcast → model) + test; small bar strip in the radar panel.
    Verify: `npx vitest run src/lib/nowcast` + Chrome
12. **Live confidence**: in the browser, hindcast t-30 → t0 with the same frames already loaded
    (reuse `score.ts`), map CSI → "ความมั่นใจ สูง/กลาง/ต่ำ" shown next to the nowcast label and ETA.
    Pure threshold function + test. Verify: `npx vitest run src/lib/nowcast` + Chrome
13. **ETA on the home page**: small line under the season chip ("ฝนน่าจะถึงใน ~20 นาที · ความมั่นใจ
    กลาง"), same hook as the map (4 z5 tiles ≈ 20 KB), hidden when no approaching rain or saveData;
    must not pull maplibre into `/` (check home JS). Verify: build + home JS size + Chrome
14. **Deploy + real-phone test** (needs the user): install Vercel CLI, user logs in and links the
    project, **user rotates the Google key** and sets `GOOGLE_MAPS_API_KEY` in Vercel, Claude runs a
    **preview** deploy (production only on explicit OK), then user opens it on a real phone; Claude
    reads the numbers (wind fps, nowcast computeMs, 3D toggle) from a small `?debug=1` overlay.
    Verify: preview URL returns 200 for `/`, `/map`, `/api/weather`, `/api/wind`

## Risks
- Extrapolation can't see storms forming/decaying (typical Thai afternoon storms): expect
  CSI ~0.5 at +30 min, ~0.3 at +60 min even when the spike passes → fade + hedged wording.
- B at 1° (~110 km) is a coarse outlook, not radar → probability alpha + "แบบจำลอง" label.
- Phone CPU: if computeMs > 500 ms on a real phone, move A server-side (lib is runtime-agnostic).
- RainViewer shutdown kills A (timeline degrades to model-only).

## Out of scope
Local/tiled motion field, growth/decay modelling, Web Worker, server-side nowcast, home-page changes.

## Spike result (task 2) — 2026-09-28, `node scripts/nowcast-spike.mts`
| window (UTC) | coverage | motion | +30 min CSI adv / persist | +60 min CSI adv / persist |
|---|---|---|---|---|
| 07:10→08:40 | 8.4 % | 29 km/h | 0.565 / 0.567 | 0.441 / 0.466 |
| 06:40→08:10 (`OFFSET=30`) | 7.7 % | 30 km/h | 0.584 / 0.586 | 0.445 / 0.439 |

Advection does not beat persistence at +30 min → gate failed. Slow-moving afternoon convection
(growth/decay in place) dominates; a single global motion vector adds nothing.
**CUT:** tasks 7, 8, 9 (nowcast hook/layers/ETA), 12 (live confidence), 13 (home ETA).
**KEEP:** 1 (library, reusable), 3–6, 10, 11 (without nowcast segment).
