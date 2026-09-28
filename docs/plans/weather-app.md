# Plan: ฟ้าวันนี้ — simple weather web app (clone of baby-care)

Status: APPROVED (2026-09-28)

## Context
User wants a simple weather forecast web app for ordinary people, built on Google Maps Platform
Weather API (powered by WeatherNext 3 since 2026-09-03), starting from the baby-care Next.js shell
(`/Users/mcr002/Desktop/baby-care`). Target: `/Users/mcr002/Desktop/forcast` (empty, not git).
User choices: current + hourly + 10-day; city search + GPS; saved favourites; alerts + plain-language
advice; "add what you recommend"; **no login/DB** (localStorage); **Thai + English**.
Design by Fable (thinker-fable), fact-checked by Claude against Google docs.

## Decisions
- **Clone = whitelist copy**, not copy-all-then-delete (baby-care has ~150 domain files, DB, auth).
- Stack kept: Next ^16.3.5 App Router, React 19, TS, zod, Tailwind 4 + CSS vars, sonner, date-fns +
  @date-fns/tz, @vercel/analytics/speed-insights, vitest, eslint. Dropped: drizzle/neon, better-auth,
  aws, resend, web-push, qrcode, lottie, playwright, mascot/emoji system, `src/proxy.ts`.
- **AGENTS.md rule stays**: read `node_modules/next/dist/docs/` before writing Next code.
- **One bundle route** `GET /api/weather?lat&lon&lang` → parallel upstream calls:
  `currentConditions:lookup`, `forecast/hours:lookup?hours=24` (pageSize max 24 → 1 page),
  `forecast/days:lookup?days=10&pageSize=10`, `publicAlerts:lookup`. zod-validate → normalize to one
  `WeatherSnapshot`. Round lat/lon to 2 decimals; in-memory Map 10 min +
  `Cache-Control: public, s-maxage=600, stale-while-revalidate=1800`. No `"use cache"`.
- API key server-only: `GOOGLE_MAPS_API_KEY` (never `NEXT_PUBLIC_`). No key → 503 `{error:"no_key"}`;
  upstream 403/429/timeout(8s) → 502 `{error:"upstream"}`; client shows last cached snapshot.
- **Geocoding: Open-Meteo** (free, no key) behind `GET /api/geocode?q&lang`, `s-maxage=86400`.
  Swappable to Google Geocoding in one file. GPS location labelled "ตำแหน่งปัจจุบัน" (no reverse geocode).
- **Condition map**: static table for all `weatherCondition.type` enum values (+ `TYPE_UNSPECIFIED`
  fallback) → `{th, en, group}`. Icons = API `iconBaseUri` + `.svg` / `_dark.svg` via plain `<img>`.
- **Advice engine** `advise()` pure function → `warn` (banner) / `tip` (chip): rain ≥40% next 6h →
  umbrella; thunder ≥50% → storm warn; heat index ≥40 → heat warn; UV ≥8 warn / 6–7 tip; gust ≥50 km/h
  → wind warn; tomorrow max ≥3° lower → cooler; humidity ≥85 & temp ≥32 → sticky. Max 3 tips.
- Metric only. All times formatted with `TZDate` in the snapshot's `timeZone.id`.
- Favourites + last snapshot + theme + locale in localStorage/cookie (keys prefixed `fah-`).

## Thailand-first additions (user: "มีอะไรแนะนำเพิ่มใส่มาได้เลย เน้นประเทศไทยเป็นหลัก")
- **77-province quick list** `src/lib/provinces.ts` (th/en name, lat/lon, static, offline): search
  hits this first (instant, perfect Thai spelling), Open-Meteo only for districts/abroad. Also fixes
  the Thai-script geocoding risk. Default location = กรุงเทพมหานคร.
- **PM2.5 / AQI is required** (was optional): Air Quality API, same key; card shows µg/m³ + Thai level
  (ดี / ปานกลาง / เริ่มมีผลต่อสุขภาพ / มีผลต่อสุขภาพ) + "ใส่หน้ากาก N95" advice.
- **Heat index in Thai health bands**: เฝ้าระวัง 27–32, เตือนภัย 33–41, อันตราย 42–51, อันตรายมาก ≥52 °C.
- **Extra advice rules** (Thai daily life): "ฝนน่าจะเริ่มตก ~15:00" (first hour rain ≥50%);
  "ระวังฝนช่วงเดินทาง" (rain ≥40% in 06–09 or 16–19); "ตากผ้าได้ / ไม่ควรตากผ้า" (daytime, rain <20%
  next 6h & humidity <75%); "ออกกำลังกายกลางแจ้ง: เหมาะ / ไม่เหมาะ" (combines AQI + heat + rain);
  "ฝนตกหนักต่อเนื่อง ระวังน้ำท่วมขัง" (daily rain ≥35 mm or ≥3 consecutive rainy days).
- **Share to LINE** (`https://line.me/R/share?text=`) plus Web Share / copy fallback.
- **Emergency numbers** in alerts card: ปภ. 1784, กรมอุตุฯ 1182, เจ็บป่วยฉุกเฉิน 1669.
- Thai dates in พ.ศ., Thai day names; Thai is the default locale.

## Where Claude disagrees with Fable
- Fable said `publicAlerts` does **not** cover Thailand. Google's coverage page (fetched this session)
  lists TH with full support incl. weather alerts. → Show official alerts first; derived warns from
  `advise()` remain as a supplement/fallback (also handles `{}` / empty response).
- Fable put PM2.5 fully out of scope. User asked for Thailand-focused extras → PM2.5 is **Task 6b,
  required** (Air Quality API, same key, POST `airquality.googleapis.com/v1/currentConditions:lookup`).
- Thailand additions above are Claude's, not Fable's.

## Tasks (1 Codex dispatch each; sequential)

1. **Scaffold from baby-care (whitelist).** Copy: `package.json, tsconfig.json, eslint.config.mjs,
   postcss.config.mjs, vitest.config.mts, next.config.ts, vercel.json, .gitignore, AGENTS.md, CLAUDE.md,
   src/app/{layout.tsx,globals.css,locale-actions.ts}, src/app/api/version, src/app/manifest.webmanifest,
   src/i18n/{core.ts,core.test.ts,server.ts,client.tsx,en/index.ts}, src/lib/{theme.ts,theme.test.ts,
   version.ts,version.test.ts,install.ts}, src/components/{theme-controller,version-watcher,
   install-button,offline-support,language-switch}.tsx, public/{manifest.json,sw.js,sw-routing.js,
   icon*.png,apple-touch-icon.png}, test/, scripts/i18n-check.mjs`.
   Trim deps to the kept list; `lint` script = `eslint` (drop emoji-check). Remove DB/auth/mascot/emoji
   imports from layout, i18n/server.ts (cookie only, rename cookie `fah-locale`), locale-actions (no
   DB), manifest route, en/index.ts (empty dict spread), install.ts/offline-support/language-switch.
   `vercel.json`: keep `regions:["sin1"]`, drop `crons`. Placeholder `src/app/page.tsx`.
   `.env.example` = `GOOGLE_MAPS_API_KEY=`. `git init`. Never copy `.env.local .git .next node_modules
   .cache data docs`.
   Verify: `npm install && npm run typecheck && npx vitest run && npm run build`
2. **Weather types/schema/normalize** `src/lib/weather/{types,schema,normalize}.ts` + test with fixture
   JSON shaped per Google REST reference (current, hours, days, alerts; alerts may be `{}`).
   Verify: `npx vitest run src/lib/weather/normalize.test.ts`
3. **Condition table** `src/lib/condition.ts` + test asserting every enum value has th/en/group.
   Verify: `npx vitest run src/lib/condition.test.ts`
4. **Advice engine** `src/lib/advise.ts` + test (base rules + Thai rules + heat-index bands above;
   optional `aqi` input so PM2.5/exercise rules work once 6b lands; table-driven).
   Verify: `npx vitest run src/lib/advise.test.ts`
5. **Upstream client** `src/lib/weather/client.ts` (server-only, 4 URLs, timeout, typed errors) +
   `src/lib/geo.ts` (rounding, validation) + test.
   Verify: `npx vitest run src/lib/geo.test.ts && npm run typecheck`
6. **`/api/weather` route** (validation, Map cache, headers, error codes).
   Verify: `npm run build && (npm run start & sleep 6; curl -s -i 'localhost:3000/api/weather?lat=13.75&lon=100.50&lang=th' | head -c 600; kill %1)` — no key → 503; with key → 200 JSON
6b. **PM2.5 `/api/air` route** + `src/lib/air.ts` (normalize, Thai PM2.5 level mapping) + test;
    30-min cache, same error codes.
    Verify: `npx vitest run src/lib/air.test.ts && npm run build`
7. **Provinces + `/api/geocode` + favourites**: `src/lib/provinces.ts` (77 entries, local search th/en)
   + test (count 77, "เชียงใหม่"/"chiang mai" hit); route searches provinces first then Open-Meteo
   (count=8, retry `en` on zero hits); `src/lib/favourites.ts` (localStorage CRUD, max 8, dedupe by
   rounded coords) + test.
   Verify: `npx vitest run src/lib/provinces.test.ts src/lib/favourites.test.ts && npm run build`
8. **i18n + formatting**: `src/i18n/en/{common,weather,advice}.ts`, `src/lib/format.ts` (TZDate
   hour/day labels, Thai Buddhist-era dates) + test.
   Verify: `node scripts/i18n-check.mjs && npx vitest run src/lib/format.test.ts`
9. **Hooks** `src/hooks/{use-weather,use-favourites}.ts` (snapshot-first paint, refetch on focus/online,
   10-min staleness, "อัปเดต N นาทีที่แล้ว").
   Verify: `npm run typecheck && npm run lint`
10. **Home page + location-bar + search-box + GPS button** (debounced search, keyboard nav; GPS denied →
    toast + default Bangkok 13.75,100.50).
    Verify: `npm run build`
11. **current-card + aqi-card + advice-strip + alerts-card** (big temp, feels-like, heat-index band,
    one-line plain summary, humidity/wind in words; PM2.5 card; official alerts first, else derived
    warns; emergency numbers 1784/1182/1669 as `tel:` links).
    Verify: `npm run build && node scripts/i18n-check.mjs`
12. **hourly-strip (24h, rain-chance bar) + daily-list (10 days, hi/lo, rain %, expand day/night) +
    sun-card (sunrise/sunset, UV word).**
    Verify: `npm run build`
13. **Favourites UI + share-button** (LINE share link, Web Share API, clipboard fallback).
    Verify: `npm run typecheck && npm run lint`
14. **PWA**: rewrite `sw-routing.js` routes (`/`, `/_next/static/`, icons, `maps.gstatic.com/weather/`),
    bump CACHE name, update manifest (name "ฟ้าวันนี้", start_url `/`, colours, no shortcuts), update
    `test/sw-routing.test.ts`.
    Verify: `npx vitest run test/sw-routing.test.ts`
15. **Settings sheet + README** (theme, language, install, clear data; README: key setup, restrict key
    to Weather API, per-SKU daily quota cap ~330/day).
    Verify: `npm run lint && npm run typecheck && npx vitest run && npm run build`

## Verification (end-to-end, by Claude)
- After each task: `git diff`, run that task's Verify, paste real output.
- End: `.env.local` with real key → `npm run dev`; open in Chrome: search "เชียงใหม่", GPS, add
  favourite, switch TH/EN, dark mode, offline reload shows cached snapshot; check Network tab that the
  API key never reaches the browser.

## Out of scope
Radar/maps, push notifications, login/sync, history endpoint, imperial units, reverse geocoding,
TMD scraping, deploy to Vercel (separate step on request).

## Notes
- Copy this file to `/Users/mcr002/Desktop/forcast/docs/plans/weather-app.md` after Task 1 so Codex
  (sandboxed to `forcast`) reads it from the workspace.
- Open-Meteo is now only the fallback (districts/abroad); provinces cover the main Thai use case.
- README must say to enable **both** Weather API and Air Quality API on the key.
