# Plan: map-first redesign

Status: APPROVED 2026-10-06 (user approved the plan after "มีอะไรแนะนำเพิ่มเติมใส่มาได้เลย"; Claude's extras added as Phase 6).


## Context
User (2026-10-06), after rejecting the 3D dam concepts: "ไม่ต้องทำแบบนี้ ช่วยออกแบบ UX/UI ให้ใหม่ทั้งหมดเลยโดยไม่จำกัดแค่ Libs หรือ
Tech เดิม โดยที่ต้องการให้เน้นที่สถานการณ์น้ำท่วม, เขื่อน, การระบายน้ำ ในไทย". Answers:
- **Audience:** the public, volunteers/community leaders, and officials/media.
- **Layout:** full-screen map + bottom sheet.
- **Tech:** may change everything (free, no sign-up, Vercel).

Earlier feedback still binding:
- real reported data only, never simulated depth/levels
- minimal text, pictures first
- "น้ำ/เขื่อนไม่สวย" → no 3D dam model at all
- sources with published terms only, no sign-ups
- cheap Android must work

Design: Fable. Facts checked by Claude.

**Honest scope:** no live river level exists (HII = last month only; ThaiWater needs the letter). So the app answers three questions:
1. ตอนนี้น้ำท่วมที่ไหน
2. น้ำจากเขื่อนกำลังไหลมาทางฉันไหม
3. เขื่อนไหนใกล้เต็ม / ปล่อยหนัก

It never answers "will my home flood".

## Design (Fable)
**IA:** no tab bar. `/` = full-screen MapLibre map plus a bottom sheet with 3 detents (peek / half / full).
- **Top:** a Thailand-only search pill, lens chips **ท่วม · เขื่อน · ฝน**, a 7-day clock and a bell → alerts.
- **Pushed sheets over the same map** (the map never reloads):
  - `/dam/[id]`
  - `/river/[system]`
  - `/province/[id]`
  - `/alerts`
- **Redirects:** `/water`, `/water/dam/[id]`, `/rain` and `/map` redirect into the new routes.

**Screens (390 px)**
- **Home peek:** one status strip ("ท่วมตอนนี้ 4 จังหวัด · 3 เขื่อน >80 %" + source/time) and 3 tiles (ใกล้ฉัน · TMD warnings · radar play).
- **Home half:** mini Thailand map + list of flooded provinces.
- **Dam:** ring gauge (% capacity), release m³/s with ▲▼, 7-day bars, last year / 2554, a downstream strip of provinces along the real
  river, and the OSM reservoir polygon shaded by % (captioned "ไม่ใช่ระดับน้ำ").
- **River system:** a metro-map schematic of 5 systems (Chao Phraya, Chi–Mun, Mekong tributaries, Tapi, Pattani).
  - Edge width = summed release of the upstream dams.
  - Dashes move ∝ release.
  - HII monthly levels appear only as grey ticks labelled with their month.
  - Header says these are dam releases, not river flow.
- **Province:** satellite water ratio + 7 days, TMD warnings, dams releasing toward it, DDPM risk villages, station rain, share image.
- **Alerts:** a time-sorted list (TMD rose, GDACS/GLIDE cyan, dam >80 % / high release amber), one line each with source and time.

**Visual language**
- **Map:** dark slate basemap; water is the only saturated colour.
- **Colours:**
  - cyan = observed satellite water
  - amber = high release or a dam >80 %
  - rose = TMD warning
  - violet dashed + "แบบจำลอง" chip = model output
  - grey hatch = cloud / no report
- **Dams on the map:** ring-gauge sprites (pre-rendered per 5 % step × band).
- **Flow lines:** along `dam-paths.geojson`, width log ∝ release, 3 speed buckets (data-driven `line-dasharray` exists in MapLibre 6; the
  offset animation is per layer).
- **Type:** IBM Plex Sans Thai (OFL, next/font), tabular numbers.
- **Motion:** data-driven only, at most one continuous animation per screen, off for reduced motion and lite mode.
- **Lite (cheap Android, save-data, reduced motion):** no MapLibre; the sheet opens at full over the existing Thailand SVG
  (`src/components/visuals/th-map.tsx`).

**Tech**
- **Keep:** Next 16, React 19, Tailwind 4, MapLibre 6.11, `motion` 13 (sheet drag), `sharp` (sprites), zod.
- **Remove:** three.js, `dam.glb`, the 3D dam/near-me scenes, `src/lib/three`, `model3d`, tilt, `scripts/blender`, then the weather legacy in
  phase 5.
- **Rejected:**
  - deck.gl (~400 KB gz for 35 points)
  - Cesium (needs an ion token = sign-up)
  - Rive/Lottie (authored art keeps being rejected)
  - WebGPU (not on cheap Android)

**One design, three depths (Fable, after the audience answer)**
| Sheet detent | Audience | What it shows | Text budget |
|---|---|---|---|
| peek | public | status strip + 3 tiles (ใกล้ฉัน / เตือน / เรดาร์) | ≤ 12 words |
| half | volunteers / leaders | province rows with water-ratio bars, GDACS events, DDPM risk-village counts, upstream dams releasing toward each province | labels only |
| full | officials / media | sortable table of all dams (storage %, mcm, inflow, release, Δ7d, last year, 2554), 7-day + 365-day + 2554 charts, "คัดลอกพร้อมที่มา" (copy text with source lines and times), share image | full numbers |

**Extras recommended by Claude (free, no sign-up, real data only)** — Phase 6:
- **Offline last snapshot:** when the network drops (common in floods), show the last saved situation with "ข้อมูลเมื่อ {time}" instead of an error.
- **Emergency strip:** one tap to call ปภ. 1784 / 1669 / 191, shown on every screen.
- **Follow a province or dam:** a star saved on the device. On open, the bell shows what changed since the last visit (release up, new warning, new satellite water). No push notifications, no account.
- **LINE / social share:** province and dam share cards (image + link) via the standard share sheet, plus a LINE share URL. Volunteers spread these in groups.
- **Embeddable card:** `/embed/province/[id]` and `/embed/dam/[id]`, small cards that community and media sites can iframe. They follow the same source+time rule.
- **CSV for officials/media:** download of the dam table and the province table, with a source column.
- **Large-text mode:** bigger numbers and buttons for older users. The existing voice summary is kept and reads the peek strip.
- **2G text page `/text`:** plain HTML with no map and no JS. It shows the 3 answers and a province list for very weak signal.

**Honesty rules, made structural**
- A number component refuses to render without `{source, date}` (extend `src/components/ui/source-time.tsx`).
- Model data only renders inside `<ModelChip>`.
- A vitest forbids "ปลอดภัย"/"safe" in `src/i18n`.
- "No water" always carries the cloud %.

## Process (CLAUDE.md flow)
Codex does one task per dispatch. Claude verifies each with the git diff, the Verify line, the full vitest, a 390 px Playwright screenshot
(light/dark) and Chrome when it is visible, then commits. Push happens at the end of each phase, followed by `verify:deploy` and live
screenshots. The executable copy goes to `docs/plans/map-first.md`. `wip/osm-dam-scene` stays parked (superseded).

## Tasks
**Phase A — sign-off mockup (Claude, before any code)**
A1. Interactive HTML mockup artifact of Home peek/half, Dam, River (Chao Phraya), Province and Alerts at 390 px, using today's real numbers
    (RID / flood-now / TMD) as static sample data. The user approves or adjusts before Phase 0. Verify: the user says OK.

**Phase 0 — subtract (fast, visible: lighter app)**
0.1 Delete the three.js stack + glb + tilt; `/water/dam/[id]` keeps the SVG hero.
    Verify: `grep -rl 'from "three"' src | wc -l` = 0; `npx vitest run --no-file-parallelism`; `npm run build` chunk size smaller (record before/after).
0.2 Design tokens + IBM Plex Sans Thai + colour roles in `src/app/globals.css`, `src/app/layout.tsx`.
    Verify: vitest theme test; build.

**Phase 1 — map-first home**
1.1 `scripts/rivers/build-systems.mjs` → `public/data/river-systems.json` (5 systems; nodes from `public/data/dam-downstream.json` + province
    ids). Verify: script asserts every damId is in `dam-paths.geojson` (35/35) and every province id is among the 77.
1.2 Ring-gauge sprites (`scripts/map/build-ring-sprites.mjs`, sharp) + `use-dams-layer.ts` uses them; pure `ringStep(pct)`. Verify: vitest + sprite count.
1.3 Flow lines: `src/lib/map/flow-scale.ts` (0 → 1 px, 2000 → 8 px, null → dotted grey, 3 speed buckets) + `use-dam-path-layer.ts`. Verify: vitest flow-scale.
1.4 Province choropleth from `/api/flood-now` `provinceCounts` (77) + cloud hatch in `use-satellite-flood-layer.ts`. Verify: vitest opacity fn; curl 77 keys.
1.5 Bottom sheet (3 detents, motion drag) + lens chips + peek strip + 3 tiles; `/` becomes it; remove `bottom-nav.tsx` and keep the whats-new/favourites data.
    Verify: vitest `src/components/sheet`; Playwright 390 px peek/half.

**Phase 2 — dam:** 2.1 `/dam/[id]` (ring, bars, downstream strip, OSM polygon by %) + redirects from `/water/dam/[id]`. Verify: curl 308 Location; vitest source+date present.
**Phase 3 — drainage:** 3.1 `/river/[system]` SVG schematic from `river-systems.json` + `ObservedRelease` (`src/lib/rivers/types.ts`).
    Verify: vitest edge width = summed upstream release, null → dotted, every node has `<title>`.
**Phase 4 — province + alerts:** 4.1 `/province/[id]`, `/alerts`, share image. Verify: vitest no "ปลอดภัย/safe"; verify-deploy paths added.
**Phase 5 — cleanup + lite:** 5.1 Redirect `/rain`, `/water`, `/map`; remove the weather cards + `public/anim` (936 KB) + unused APIs (keep
  `/api/weather` if the share image uses it); lite = SVG Thailand without MapLibre.
  Verify: build; `node scripts/sources-check.mjs`; vitest on the lite gate; verify-deploy (33 paths updated in the same task as the route moves).

**Phase 6 — extras**
6.1 Offline snapshot. The service worker keeps the last good `/api/flood-now`, `/api/dams` and `/api/tmd-warnings`; the UI shows their time.
    Verify: vitest SW routing; Playwright offline mode shows the "ข้อมูลเมื่อ" banner.
6.2 Emergency strip + large-text mode. Verify: vitest; Playwright 390 px at large text, no horizontal scroll.
6.3 Follow + "changed since last visit" in the bell. Verify: vitest diff function (release ▲, new warning, new satellite water).
6.4 Share cards + LINE link + `/embed/*` routes. Verify: curl 200 for the embed routes; vitest that each card has source+time.
6.5 CSV download (dams, provinces) and the `/text` 2G page. Verify: curl `/text` < 30 KB with no `<script>`; vitest CSV header includes the source.

## Watch out
- **Route moves:** `scripts/verify-deploy.mjs` (33 paths), `public/sw.js` + `sw-routing.js`, the manifest `start_url` and the
  `src/lib/version.ts` bump all change in the same task as the routes they cover.
- **Open-Meteo quota:** no model rain on load; only in lens ฝน.
- **Attribution:** keep ODbL (OSM, geoBoundaries) and CC BY-NC (HII) visible where used.
- **i18n:** run `node scripts/i18n-check.mjs` every task.
- **Reminders for the user:** rotate the Google key; send the HII/ThaiWater letter (the only path to live river levels).

## Out of scope
Live river levels, any flood prediction or depth, a DB, auth, push notifications.
