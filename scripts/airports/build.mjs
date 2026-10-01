// Thai airports that publish METAR → public/data/th-airports.json
//   node scripts/airports/build.mjs
// Coordinates/names: OurAirports (public domain, ourairports.com/data). Kept only if aviationweather.gov returns a METAR.
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// Thai names (the airports' common Thai names; OurAirports has English only). A new ICAO here fails the build until named.
const NAMES_TH = {"VTBD": "ดอนเมือง", "VTBO": "ตราด", "VTBS": "สุวรรณภูมิ", "VTBU": "อู่ตะเภา", "VTCC": "เชียงใหม่", "VTCH": "แม่ฮ่องสอน", "VTCL": "ลำปาง", "VTCN": "น่าน", "VTCP": "แพร่", "VTCT": "แม่ฟ้าหลวง เชียงราย", "VTPB": "เพชรบูรณ์", "VTPH": "หัวหิน", "VTPM": "แม่สอด", "VTPO": "สุโขทัย", "VTPP": "พิษณุโลก", "VTSB": "สุราษฎร์ธานี", "VTSC": "นราธิวาส", "VTSE": "ชุมพร", "VTSF": "นครศรีธรรมราช", "VTSG": "กระบี่", "VTSM": "สมุย", "VTSP": "ภูเก็ต", "VTSR": "ระนอง", "VTSS": "หาดใหญ่", "VTST": "ตรัง", "VTUD": "อุดรธานี", "VTUI": "สกลนคร", "VTUK": "ขอนแก่น", "VTUL": "เลย", "VTUO": "บุรีรัมย์", "VTUQ": "นครราชสีมา", "VTUU": "อุบลราชธานี", "VTUV": "ร้อยเอ็ด", "VTUW": "นครพนม"};

const root = fileURLToPath(new URL("../..", import.meta.url));
const headers = { "User-Agent": "fahwanni/1.0 (https://fahwanni.vercel.app; build script)" };

function parseCsv(text) {
  const rows = []; let field = "", row = [], quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) { if (c === '"' && text[i + 1] === '"') { field += '"'; i++; } else if (c === '"') quoted = false; else field += c; }
    else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [head, ...body] = rows;
  return body.map((cells) => Object.fromEntries(head.map((key, i) => [key, cells[i] ?? ""])));
}

const csv = await (await fetch("https://davidmegginson.github.io/ourairports-data/airports.csv", { headers })).text();
const thai = parseCsv(csv).filter((row) => row.iso_country === "TH" && /^VT[A-Z]{2}$/.test(row.ident)
  && ["large_airport", "medium_airport", "small_airport"].includes(row.type));
const ids = thai.map((row) => row.ident);
const reporting = new Set();
for (let i = 0; i < ids.length; i += 40) {
  const response = await fetch(`https://aviationweather.gov/api/data/metar?ids=${ids.slice(i, i + 40).join(",")}&format=json&hours=6`, { headers });
  if (response.status === 200) for (const item of await response.json()) reporting.add(item.icaoId);
}
const airports = thai.filter((row) => reporting.has(row.ident)).map((row) => ({
  icao: row.ident, name: row.name, nameTh: NAMES_TH[row.ident] ?? (() => { throw new Error(`No Thai name for ${row.ident}`); })(), lat: Math.round(Number(row.latitude_deg) * 1e4) / 1e4, lon: Math.round(Number(row.longitude_deg) * 1e4) / 1e4,
})).sort((a, b) => a.icao.localeCompare(b.icao));
await writeFile(join(root, "public/data/th-airports.json"), `${JSON.stringify({ source: "OurAirports (public domain)", airports }, null, 1)}\n`);
console.log(`Thai airports: ${thai.length} with ICAO, ${airports.length} publish METAR`);
