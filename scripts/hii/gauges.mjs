export function parseCsv(input) {
  const rows = [];
  let row = [], cell = "", quoted = false;
  const text = input.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (char === "," && !quoted) { row.push(cell.trim()); cell = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = []; cell = "";
      if (char === "\r" && text[i + 1] === "\n") i++;
    } else cell += char;
  }
  if (quoted) throw new Error("Unclosed CSV quote");
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  const [header = [], ...values] = rows;
  return { header, rows: values.map((cells) => Object.fromEntries(header.map((key, index) => [key, cells[index] ?? ""]))) };
}

const normalized = (key) => key.toLowerCase().replace(/[^a-z0-9\u0E00-\u0E7F]/g, "");
export function column(header, aliases, required = true) {
  const found = header.find((key) => aliases.includes(normalized(key)));
  if (!found && required) throw new Error(`Missing column [${aliases.join(", ")}]; CSV headers: ${header.join(", ")}`);
  return found;
}

export function numberOf(value) {
  if (value == null || String(value).trim() === "") return null;
  const valueNumber = Number(value);
  return Number.isFinite(valueNumber) ? valueNumber : null;
}

export function dateOf(value) {
  const raw = String(value ?? "").trim();
  const match = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (!match) return null;
  const year = Number(match[1]) > 2400 ? Number(match[1]) - 543 : Number(match[1]);
  const date = `${year}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().startsWith(date) ? date : null;
}

export function stationsFromCsv(csv) {
  const { header, rows } = parseCsv(csv);
  const code = column(header, ["stationcode", "stationid", "stncode", "stnid", "code", "id"]);
  const name = column(header, ["stationname", "stnname", "name", "stationnameth", "stnnameth"]);
  const lat = column(header, ["lat", "latitude", "stationlat", "stationlatitude"]);
  const lon = column(header, ["lon", "lng", "long", "longitude", "stationlon", "stationlong", "stationlongitude"]);
  const bank = column(header, ["bankmsl", "banklevelmsl", "banklevel", "groundlevel", "groundmsl"], false);
  const subBasin = column(header, ["subbasinname", "subbasin"], false);
  return { header, stations: rows.flatMap((row) => {
    const latitude = numberOf(row[lat]), longitude = numberOf(row[lon]);
    if (!row[code] || latitude === null || longitude === null || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return [];
    return [{ code: row[code], name: row[name], lat: latitude, lon: longitude, bankMsl: bank ? numberOf(row[bank]) : null,
      subBasin: subBasin ? row[subBasin] : "" }];
  }) };
}

export function distanceKm(a, b) {
  const rad = Math.PI / 180, dLat = (a.lat - b.lat) * rad, dLon = (a.lon - b.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

/** Thai river name as HII writes it in sub-basin names ("แม่น้ำยมตอนล่าง…", "ที่ราบแม่น้ำเจ้าพระยา"). */
export const RIVER_TH = { Ping: "ปิง", Wang: "วัง", Yom: "ยม", "Chao Phraya": "เจ้าพระยา", Mekong: "โขง", Chi: "ชี",
  Mun: "มูล", Tapi: "ตาปี", Pattani: "ปัตตานี" };

/**
 * Nearest gauge on the same river: its sub-basin must name the river, and canal gauges ("คลอง", e.g. a gate at a
 * canal mouth) are skipped — the nearest point on the map is not always on the main stream.
 */
export function nearestStation(point, stations, maxKm = 10) {
  const river = RIVER_TH[point.river];
  return stations.filter((station) => !station.name?.includes("คลอง") && (!river || !station.subBasin || station.subBasin.includes(river)))
    .map((station) => ({ station, km: distanceKm(point, station) }))
    .filter(({ km }) => km <= maxKm).sort((a, b) => a.km - b.km)[0]?.station ?? null;
}

/** Readings more than `spreadM` from the month's median are logger faults (e.g. 20,833 m), not water. */
export function dropOutliers(values, spreadM = 10) {
  const sorted = [...values].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  return values.filter((value) => Math.abs(value - median) <= spreadM);
}

export function summarizeGaugeCsv(csv, month) {
  const { header, rows } = parseCsv(csv);
  const dateKey = column(header, ["date", "datetime", "observedat", "waterleveldate", "waterleveldatetime", "measuredate", "measuredatetime", "timestamp"]);
  const levelKey = column(header, ["waterlevelmsl", "levelmsl", "waterlevel", "waterlevelm", "waterlevelvalue", "level"]);
  const bankKey = column(header, ["bankmsl", "banklevelmsl", "banklevel"], false);
  const daily = new Map();
  const banks = [];
  for (const row of rows) {
    const date = dateOf(row[dateKey]), level = numberOf(row[levelKey]);
    if (!date?.startsWith(`${month}-`) || level === null) continue;
    daily.set(date, [...(daily.get(date) ?? []), level]);
    const bank = bankKey ? numberOf(row[bankKey]) : null;
    if (bank !== null) banks.push(bank);
  }
  if (!daily.size) throw new Error(`No valid water levels for ${month}; CSV headers: ${header.join(", ")}`);
  const kept = new Set(dropOutliers([...daily.values()].flat()));
  for (const [date, levels] of daily) {
    const clean = levels.filter((level) => kept.has(level));
    if (clean.length) daily.set(date, clean); else daily.delete(date);
  }
  const dates = [...daily.keys()].sort();
  const means = dates.map((date) => daily.get(date).reduce((a, b) => a + b, 0) / daily.get(date).length);
  const round = (value) => Math.round(value * 100) / 100;
  return { header, levelMsl: { min: round(Math.min(...means)), mean: round(means.reduce((a, b) => a + b, 0) / means.length), max: round(Math.max(...means)) },
    bankMsl: banks.length ? round(banks[0]) : null, days: { from: dates[0], to: dates.at(-1), count: dates.length } };
}

/** A pinned HII code (observed points) wins over the nearest-station rule; unknown or file-less codes yield null. */
export function pickStation(point, stations) {
  if (point.gauge) return stations.find((station) => station.code.toUpperCase() === point.gauge.toUpperCase()) ?? null;
  return nearestStation(point, stations);
}

/** A logger that reports the same value all month (e.g. PRN001: 4,464 zeros in 2026-07) is a fault, not a level. */
export function isFlatline(levelMsl, days) {
  return days.count >= 7 && levelMsl.max - levelMsl.min < 0.001;
}
