/**
 * The 35 large dams reported by RID (app.rid.go.th/reservoir/api/dam/public), which has no coordinates.
 * Coordinates: Wikidata (CC0) or OpenStreetMap (ODbL, © OpenStreetMap contributors) — see
 * scripts/dams/registry-sources.json for the item or way each came from. English names are the common
 * romanisations; provinces use ids from src/lib/provinces.ts.
 */
export interface RegisteredDam {
  id: string;
  nameTh: string;
  nameEn: string;
  provinceId: string;
  lat: number;
  lon: number;
  coordSource: "wikidata" | "osm";
}

export const DAM_REGISTRY: readonly RegisteredDam[] = [
  { id: "100104", nameTh: "แม่กวงอุดมธารา", nameEn: "Mae Kuang Udom Thara", provinceId: "chiang-mai", lat: 18.9267, lon: 99.1254, coordSource: "wikidata" },
  { id: "100105", nameTh: "กิ่วลม", nameEn: "Kio Lom", provinceId: "lampang", lat: 18.5236, lon: 99.6247, coordSource: "wikidata" },
  { id: "100106", nameTh: "กิ่วคอหมา", nameEn: "Kiew Kho Ma", provinceId: "lampang", lat: 18.8088, lon: 99.6441, coordSource: "wikidata" },
  { id: "100107", nameTh: "แควน้อยบำรุงแดน", nameEn: "Khwae Noi Bamrung Daen", provinceId: "phitsanulok", lat: 17.1818, lon: 100.4120, coordSource: "wikidata" },
  { id: "100108", nameTh: "แม่มอก", nameEn: "Mae Mok", provinceId: "lampang", lat: 17.3236, lon: 99.4097, coordSource: "wikidata" },
  { id: "200101", nameTh: "ภูมิพล", nameEn: "Bhumibol", provinceId: "tak", lat: 17.2428, lon: 98.9722, coordSource: "wikidata" },
  { id: "200102", nameTh: "สิริกิติ์", nameEn: "Sirikit", provinceId: "uttaradit", lat: 17.7647, lon: 100.5636, coordSource: "wikidata" },
  { id: "200103", nameTh: "แม่งัดสมบูรณ์ชล", nameEn: "Mae Ngat Somboon Chon", provinceId: "chiang-mai", lat: 19.1614, lon: 99.0398, coordSource: "wikidata" },
  { id: "100201", nameTh: "ห้วยหลวง", nameEn: "Huai Luang", provinceId: "udon-thani", lat: 17.2914, lon: 102.5959, coordSource: "osm" },
  { id: "100202", nameTh: "น้ำอูน", nameEn: "Nam Oon", provinceId: "sakon-nakhon", lat: 17.3039, lon: 103.7558, coordSource: "wikidata" },
  { id: "100206", nameTh: "ลำปาว", nameEn: "Lam Pao", provinceId: "kalasin", lat: 16.6094, lon: 103.4164, coordSource: "wikidata" },
  { id: "100207", nameTh: "ลำตะคอง", nameEn: "Lam Takhong", provinceId: "nakhon-ratchasima", lat: 14.8647, lon: 101.5603, coordSource: "wikidata" },
  { id: "100208", nameTh: "ลำพระเพลิง", nameEn: "Lam Phra Phloeng", provinceId: "nakhon-ratchasima", lat: 14.5942, lon: 101.8394, coordSource: "wikidata" },
  { id: "100209", nameTh: "มูลบน", nameEn: "Mun Bon", provinceId: "nakhon-ratchasima", lat: 14.4840, lon: 102.1477, coordSource: "wikidata" },
  { id: "100210", nameTh: "ลำแชะ", nameEn: "Lam Chae", provinceId: "nakhon-ratchasima", lat: 14.4216, lon: 102.2687, coordSource: "wikidata" },
  { id: "100211", nameTh: "ลำนางรอง", nameEn: "Lam Nang Rong", provinceId: "buri-ram", lat: 14.2723, lon: 102.7662, coordSource: "wikidata" },
  { id: "200203", nameTh: "น้ำพุง", nameEn: "Nam Phung", provinceId: "sakon-nakhon", lat: 16.9733, lon: 103.9806, coordSource: "wikidata" },
  { id: "200204", nameTh: "จุฬาภรณ์", nameEn: "Chulabhorn", provinceId: "chaiyaphum", lat: 16.5363, lon: 101.6500, coordSource: "wikidata" },
  { id: "200205", nameTh: "อุบลรัตน์", nameEn: "Ubol Ratana", provinceId: "khon-kaen", lat: 16.7742, lon: 102.6192, coordSource: "wikidata" },
  { id: "200212", nameTh: "สิรินธร", nameEn: "Sirindhorn", provinceId: "ubon-ratchathani", lat: 15.2063, lon: 105.4292, coordSource: "wikidata" },
  { id: "100301", nameTh: "ป่าสักชลสิทธิ์", nameEn: "Pa Sak Jolasid", provinceId: "lop-buri", lat: 14.8614, lon: 101.0661, coordSource: "wikidata" },
  { id: "100302", nameTh: "ทับเสลา", nameEn: "Thap Salao", provinceId: "uthai-thani", lat: 15.5358, lon: 99.4475, coordSource: "wikidata" },
  { id: "100303", nameTh: "กระเสียว", nameEn: "Krasiao", provinceId: "suphan-buri", lat: 14.8371, lon: 99.6643, coordSource: "wikidata" },
  { id: "200401", nameTh: "ศรีนครินทร์", nameEn: "Srinagarind", provinceId: "kanchanaburi", lat: 14.4094, lon: 99.1283, coordSource: "wikidata" },
  { id: "200402", nameTh: "วชิราลงกรณ", nameEn: "Vajiralongkorn", provinceId: "kanchanaburi", lat: 14.7994, lon: 98.5969, coordSource: "wikidata" },
  { id: "100501", nameTh: "ขุนด่านปราการชล", nameEn: "Khun Dan Prakan Chon", provinceId: "nakhon-nayok", lat: 14.3119, lon: 101.3209, coordSource: "wikidata" },
  { id: "100502", nameTh: "คลองสียัด", nameEn: "Khlong Si Yat", provinceId: "chachoengsao", lat: 13.4260, lon: 101.6730, coordSource: "osm" },
  { id: "100503", nameTh: "บางพระ", nameEn: "Bang Phra", provinceId: "chon-buri", lat: 13.2100, lon: 100.9794, coordSource: "wikidata" },
  { id: "100504", nameTh: "หนองปลาไหล", nameEn: "Nong Pla Lai", provinceId: "rayong", lat: 12.9494, lon: 101.2628, coordSource: "wikidata" },
  { id: "100505", nameTh: "ประแสร์", nameEn: "Prasae", provinceId: "rayong", lat: 12.9794, lon: 101.5672, coordSource: "osm" },
  { id: "100514", nameTh: "นฤบดินทรจินดา", nameEn: "Naruebodindrachinda", provinceId: "prachin-buri", lat: 14.0914, lon: 102.0270, coordSource: "osm" },
  { id: "100602", nameTh: "ปราณบุรี", nameEn: "Pran Buri", provinceId: "prachuap-khiri-khan", lat: 12.4640, lon: 99.7933, coordSource: "wikidata" },
  { id: "200601", nameTh: "แก่งกระจาน", nameEn: "Kaeng Krachan", provinceId: "phetchaburi", lat: 12.9020, lon: 99.5990, coordSource: "wikidata" },
  { id: "200603", nameTh: "รัชชประภา", nameEn: "Ratchaprapha", provinceId: "surat-thani", lat: 8.9721, lon: 98.8058, coordSource: "osm" },
  { id: "200604", nameTh: "บางลาง", nameEn: "Bang Lang", provinceId: "yala", lat: 6.1556, lon: 101.2736, coordSource: "wikidata" },
];

export const damRegistryById = new Map(DAM_REGISTRY.map((dam) => [dam.id, dam]));
