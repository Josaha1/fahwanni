# Plan: new features from free sources — night sky, sea heat & coral, El Niño, airports, live webcams

Status: APPROVED 2026-10-01.
5 Oct; Claude writes until then (same flow: task → Verify → regression → headless check → commit; push at the end).

## Context
User (2026-10-01): "มี api ฟรีที่ไหนบ้างที่จะทำให้เว็บนี้มีลูกเล่นที่น่าสนใจขึ้นอีก". Fable researched ~16 candidates and checked each live
(HTTP + licence); Claude re-checked against the code. The user chose all 4 groups below. Rule: only published terms.

## Checked against code (Claude)
- `src/components/sun-card.tsx` + `src/lib/moon.ts` already show sunrise/sunset/moon phase/moonrise — no golden hour,
  planets, eclipses or meteors → extend this card, don't duplicate it.
- Heat index already exists (`src/lib/advise.ts`) → dropped.
- Google hourly has `conditionType` + `rainChance` (no cloud %) → use them for "can I see the stars tonight"; no extra API.
- `astronomy-engine` is not installed; `scripts/sources-check.mjs` exists (register new sources there + `verify:deploy`).

## Sources (checked live 2026-10-01)
| Feature | Source | Terms (quoted) | Notes |
|---|---|---|---|
| Night sky | `astronomy-engine` (npm, MIT) — computed on the device | MIT | ~200 KB → load lazily inside the card only |
| Sea temperature | NOAA OISST via ERDDAP `coastwatch.pfeg.noaa.gov/erddap/griddap/ncdcOisst21Agg_LonPM180` | public domain (NOAA) | ~2-week lag → show the date |
| Coral bleaching | NOAA Coral Reef Watch DHW 5 km `pae-paha.pacioos.hawaii.edu/erddap/griddap/dhw_5km` (pin this host; coastwatch 302s here) | "available for use without restriction", attribution + DOI | daily |
| El Niño | NOAA CPC `cpc.ncep.noaa.gov/data/indices/oni.ascii.txt` (200) | public domain (NWS/NOAA) | latest JJA 2026 ONI +1.80 |
| Airports | aviationweather.gov `/api/data/metar` (200) | public domain; "100 requests per minute"; no CORS → must proxy | ~30 Thai ICAO airports, static list (coordinates from OurAirports, public domain) |
| Live webcams | Windy Webcams API v3 | free key; "Use images only with URLs provided by the API", each image must link to the webcam page + "courtesy Windy.com", image URLs expire in 10 min, use "as is" | **needs a free key — you must sign up** |

## Tasks
F1. **Night sky (sun-card)** — `src/lib/astro.ts` (pure, tested): golden hour / blue hour today, planets above the horizon after
    dark (altitude > 10°), next solar/lunar eclipse visible from the user's location (within 2 years), static meteor-shower list
    (`src/lib/meteors.ts`, IMO peaks) + "คืนนี้ดูดาว: ดี/พอใช้/ไม่ดี" from hourly conditionType + rainChance between
    sunset and 02:00 and the moon phase. Card section loaded with `next/dynamic` (astronomy-engine stays out of the first load).
    Verify: unit tests for astro/meteors (fixed dates + Bangkok coords, compared against the library), typecheck, lint, i18n;
    headless: the section appears, home first-load JS +≤ 5 KB.
F2. **Sea heat & coral bleaching** — `/api/sea?lat&lon` → nearest sea pixel SST (OISST) + DHW/bleaching alert level
    (CRW categories: no stress / watch / warning / alert 1 / alert 2) with dates; cache 12 h + stale; on the marine card for coastal
    places + a list of 8 dive spots (เกาะเต่า, สิมิลัน, พีพี, เกาะล้าน, เกาะช้าง, เกาะหลีเป๊ะ, เกาะสุรินทร์, หินแดง) on /water or the marine card.
    Verify: route test with ERDDAP fixtures; `curl /api/sea?lat=10.09&lon=99.83` returns SST + DHW; headless card.
F3. **El Niño badge** — `/api/enso` parses ONI text (last 6 seasons, status El Niño/La Niña/neutral at ±0.5), cache 24 h; small
    badge + "ฝนน้อย/ร้อน/แล้งกว่าปกติ" explanation on /water and home (season card). Verify: parser test with the real file
    sample; curl; headless.
F4. **Airport observations** — static `public/data/th-airports.json` (ICAO, Thai/English name, lat/lon); `/api/metar?ids=` proxy
    (≤ 10 ids, cache 10 min, rate-safe); home card "ตรวจวัดจริงที่สนามบินใกล้คุณ (นาที่แล้ว)": temp, dewpoint, wind, visibility,
    CB/TS clouds → "มีเมฆฝนฟ้าคะนองใกล้สนามบิน". Verify: METAR parser tests (real samples), curl, headless.
F5. **Live webcams** — **blocked until you add `WINDY_WEBCAMS_KEY` in Vercel and `.env.local`** (sign up at api.windy.com, free).
    `/api/webcams?lat&lon` → nearby webcams (list cached ≤ 5 min, image URLs never cached), card + map layer with link-back +
    "courtesy Windy.com" on every image; hide everything when there's no key. Verify: route test (no key → 204/empty), live
    check after the key is added.
F6. **Wrap-up** — README sources, `scripts/sources-check.mjs`, `verify:deploy` paths (/api/sea, /api/enso, /api/metar, /api/webcams),
    memory data-source-rule; push; verify:deploy; live screenshots.

Order: F1 → F3 → F4 → F2 → F5 (after the key) → F6. Each is independent; F1/F3/F4 are small.

## Not allowed / dropped (from Fable's research)
Blitzortung lightning (no API, non-commercial), Air4Thai live (undocumented), TMD earthquake RSS (no licence — "สงวนลิขสิทธิ์"),
Google Pollen (no Thailand), Nager.Date holidays (no Thailand), wheretheiss.at (no terms), NASA EONET (duplicates what we have).

## For you
- Sign up for a free Windy Webcams key (api.windy.com) and add it as `WINDY_WEBCAMS_KEY` in Vercel + `.env.local` — I can't create accounts.
- Optional later: OpenAQ key (ground PM2.5 stations; also free).

> 2026-10-05: F5 (Windy webcams) removed at the user's request — "เอา windy ออกเลย ไม่ต้องการ sign up กับระบบอื่นๆ". No source that needs a sign-up.
