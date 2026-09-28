# Plan: ฟ้าวันนี้ Phase 2 — map, radar, wind, 3D, storms, Blender icons

Status: DONE (2026-09-28) — tasks 1–16 and 18–25; task 17 (optional hero video) not built

## Context
Phase 1 (docs/plans/weather-app.md) is done. User asked for rain radar + wind, a rotatable 3D map,
Blender animated icons/video, typhoon tracks, and "anything else that makes it great"; free sources
first. Design by Fable (thinker-fable); sources re-verified live by Claude on 2026-09-28.

## Decisions
- **Navigation**: bottom nav with 2 tabs, real routes `/` (พยากรณ์) and `/map` (แผนที่). Storms are a
  banner on `/` + a layer on `/map` (no storm tab: empty most of the year). Selected place is shared via
  the existing `fah-last-place` localStorage (useLastPlace).
- `/map` code (maplibre-gl) is `dynamic(..., { ssr:false })`; **`/` first-load JS may not grow > 5 KB**.
- New server routes follow the existing pattern (`WeatherCache` + `Cache-Control: s-maxage`, typed
  errors, never break the page): `/api/storms`, `/api/radar`, `/api/wind`, `/api/tmd-warnings`.
- Sources (all free, no key; verified 200 today):
  - Radar: RainViewer `api.rainviewer.com/public/weather-maps.json` (13 past frames/10 min, no nowcast,
    tiles max z7). Terms: personal/educational, credit "Weather data by RainViewer". Announced shutdown
    but still live → behind provider-agnostic `/api/radar`; empty → "เรดาร์ไม่พร้อมใช้งาน".
  - Wind: Open-Meteo forecast API, multi-coordinate, 1° grid lon 92–110 × lat 4–22 (361 pts), 24 h,
    3-h server cache. CC BY 4.0 credit. No Vercel cron (Hobby = once/day).
  - Basemap: OpenFreeMap styles (positron / dark by theme), OSM attribution.
  - Terrain: AWS Terrarium DEM (`encoding: "terrarium"`), 3D off by default.
  - Storms: JMA bosai JSON (`targetTc.json`, `{TC}/forecast.json`, `specifications.json`) for W. Pacific
    / South China Sea + GDACS TC event list for Bay of Bengal/Andaman. Credit "Source: Japan
    Meteorological Agency website". Unofficial JSON → zod lenient + fixtures.
  - Official Thai wording: TMD `data.tmd.go.th` WeatherWarningNews v2 (XML → JSON).
- Map rendering: MapLibre GL; wind particles lib chosen by a spike (mapbox-exif-layer vs
  @geoql/maplibre-gl-wind). Particles/3D auto-off on `prefers-reduced-motion`, `saveData`,
  `deviceMemory < 4`; DPR cap 1.5; `map.remove()` on unmount. SW must not cache map tiles.
- Blender: headless `~/Applications/Blender.app/Contents/MacOS/Blender -b -P` (4.5.14 LTS present),
  reuse baby-care `scripts/blender/{kit.py,build.mjs}` pattern. 7 condition groups × day/night = 14
  looping icons, 24 frames @128px → WebP **sprite sheet** via `sharp` (ffmpeg absent), CSS `steps(24)`,
  ≤120 KB/sheet, lazy per group, reduced-motion → static frame, saveData → Google SVG.
- Attribution for every source in the map attribution control + settings footer.

## Where Claude disagrees with Fable
- **Cut the mosquito/dengue heuristic.** A weather-only "dengue risk" is not a validated index; showing
  it as health advice to ordinary people could mislead. (Fable ranked it as a keeper.)
- Fable's Verify steps use Playwright; it is not installed. Browser checks (map renders, FPS, 3D
  toggle) are done by Claude in Chrome instead, not by Codex.
- Hero background video stays **optional and last** (agree), and is only built if the user asks after
  seeing the icons.

## Tasks (1 Codex dispatch each; sequential)
1. **Source smoke test** `scripts/sources-check.mjs` (RainViewer json + 1 tile, JMA targetTc, GDACS,
   OpenFreeMap style, Terrarium tile, TMD warnings, Open-Meteo multi-point).
   Verify: `node scripts/sources-check.mjs` exits 0 and prints 7 × 200
2. **Bottom nav + `/map` placeholder route** (forecast stays at `/`), i18n.
   Verify: `npm run build && npm run typecheck && node scripts/i18n-check.mjs` (build lists `/map`)
3. **`/api/storms`** + `src/lib/storms/{jma,gdacs,normalize}.ts` with fixtures, bbox 0–30N / 80–130E,
   15-min cache, `{active:false}` when none.
   Verify: `npx vitest run src/lib/storms && npm run build`
4. **`/api/tmd-warnings`** (XML → JSON, 15-min cache) + **storm banner** on `/` (name, category,
   distance/bearing to place, JMA/GDACS credit, TMD text). Verify: `npx vitest run && npm run build`
5. **`/api/radar`** provider-agnostic manifest (RainViewer adapter, zod, 5-min cache).
   Verify: `npx vitest run src/lib/radar && npm run build`
6. **Map tab 2D**: `npm i maplibre-gl`, dynamic import, OpenFreeMap style by theme, place marker,
   attribution. Verify: `npm run build` (first-load JS of `/` unchanged ±5 KB) + Claude checks in Chrome
7. **Radar layer + time scrubber** (≤6 prefetched frames, legend, "อัปเดตเมื่อ N นาทีที่แล้ว").
   Verify: `npx vitest run && npm run build` + Claude checks in Chrome
8. **`/api/wind`** grid (Open-Meteo 361 pts, 3-h cache, packed u/v JSON < 60 KB).
   Verify: `npx vitest run src/lib/wind && npm run build`
9. **Spike: wind particle lib** — Codex wires both candidates behind a flag; Claude measures FPS in
   Chrome (mid-tier mobile throttling), records result in `docs/plans/wind-spike.md`.
10. **Wind layer** with the spike winner + capability gate (pure function, tested).
    Verify: `npx vitest run && npm run build`
11. **3D toggle** (Terrarium DEM, pitch ≤60, maxZoom 12, gated, cleanup on unmount).
    Verify: `npm run build` + Claude toggles 10× in Chrome, checks memory
12. **Storm track layer** (JMA track + forecast circles, GDACS fallback; GeoJSON builder tested).
    Verify: `npx vitest run && npm run build`
13. **Spike: Blender headless** — `scripts/blender/icons.py` + `build.mjs` renders rain-day (24 frames)
    → `public/anim/rain-day.webp` sprite. Verify: `node scripts/blender/build.mjs --only rain-day`,
    file < 120 KB, width = 24×128
14. **All 14 sheets + `AnimatedConditionIcon`** (reduced-motion / saveData fallbacks; SW caches
    `/anim/*`). Verify: `npx vitest run && npm run build` + Claude visual check
15. **Extras A (pure logic)**: weekly outlook sentence, seasonal context chip, radar a11y text summary.
    Verify: `npx vitest run`
16. **Extras B**: "เทียบกับเมื่อวาน" (per-place yesterday snapshot) + favourites overview grid
    (≤5 cities, staggered ≤1 req / 6 s to respect the 10/min Google cap). Verify: `npx vitest run && npm run build`
18. **"ช่วงเวลาที่ดีที่สุดวันนี้"** (pure logic over 24h hourly): best 2-h window to go out / exercise /
    wash car (lowest rain chance, heat index < 33, UV < 6, PM2.5 ok). Card on `/`.
    Verify: `npx vitest run`
19. **Share as image**: render a 1080×1350 summary card on `<canvas>` (Thai font, icon, temp, advice,
    PM2.5) → Web Share with PNG file / download fallback. Thais share images on LINE more than text.
    Verify: `npx vitest run && npm run build` + Claude shares in Chrome
20. **Read aloud (อ่านให้ฟัง)** + **large-text mode**: Web Speech API (`th-TH` / `en-US`) reads a
    short plain summary; settings toggle for bigger type. For elderly users.
    Verify: `npm run build` + Claude checks a Thai voice exists in Chrome
21. **Sea & waves (คลื่นลมทะเล)** for coastal places: Open-Meteo Marine API (free, CC BY) wave
    height/period, plain words ("คลื่นสูง 2–3 ม. งดออกเรือเล็ก"). Shown only when the place is within
    ~30 km of the sea. `/api/marine`, 1-h cache. Verify: `npx vitest run && npm run build`
22. **Farmer mode (โหมดเกษตรกร)** toggle in settings: 10-day rain total, "พ่นยาได้" window (wind < 10
    km/h & no rain 6 h), ET0 evaporation, topsoil moisture (Open-Meteo, free). `/api/agri`, 3-h cache.
    Verify: `npx vitest run && npm run build`
23. **Long-weekend forecast**: static Thai public-holiday list 2026–2027 → "วันหยุดยาวนี้ (ส.–จ.)
    ที่ <เมืองโปรด> ฝน 60%" when a long weekend falls inside the 10-day window.
    Verify: `npx vitest run`
24. **Recent earthquakes near Thailand** (USGS GeoJSON, free, public domain): M ≥ 4 within 1,000 km in
    the last 7 days as a small card + map layer, link to TMD earthquake page. `/api/quakes`, 10-min cache.
    Verify: `npx vitest run && npm run build`
25. **Moon phase** in the sun card from the days API `moonEvents` already fetched (no new source).
    Verify: `npx vitest run && npm run build`
17. *(optional, only if user asks)* hero background loop via Blender's built-in FFmpeg, ≤800 KB,
    Wi-Fi + !saveData only.

Tasks 18–25 are Claude's additions (user: "มีอะไรแนะนำเพิ่มเติมมั้ยเพิ่มมาได้เลย"); sources checked
live 2026-09-28: Open-Meteo Marine, Open-Meteo ET0/soil moisture, USGS earthquake feed all 200.
Execution order: 1–16, then 18–25, then 17 only on request.

## Out of scope
Push notifications, widgets, login/DB, paid tiers, Himawari imagery, JTWC parsing, TMD radar
scraping, rain-arrival nowcast (free radar has no nowcast frames), dengue/mosquito index, pollen,
lightning strikes (no clearly free, redistributable source found — not verified, revisit later), วันพระ/religious calendar (not weather).

## Risks
- RainViewer may stop any day (UI degrades gracefully; NASA GIBS IMERG is a 4–5 h-old fallback).
- RainViewer and Open-Meteo free tiers are **non-commercial** — fine for a free, ad-free app; revisit
  if monetized.
- MapLibre terrain memory issues on some Android WebViews → 3D is opt-in and gated.
