export type WaterRiver = {
  id: string;
  nameTh: string;
  nameEn: string;
  aliases: string[];
  dams: string[];
  points: string[];
  noPointReason?: "dam-controlled";
};

/** Search associations confirmed for water search; dam ids are RID ids. */
export const waterRivers: WaterRiver[] = [
  { id: "ping", nameTh: "ปิง", nameEn: "Ping", aliases: [], dams: ["200101", "100104", "200103"], points: ["ping-chiangmai"] },
  { id: "wang", nameTh: "วัง", nameEn: "Wang", aliases: [], dams: ["100105", "100106"], points: ["wang-lampang"] },
  { id: "yom", nameTh: "ยม", nameEn: "Yom", aliases: [], dams: ["100108"], points: ["yom-sukhothai"] },
  { id: "nan", nameTh: "น่าน", nameEn: "Nan", aliases: [], dams: ["200102", "100107"], points: ["nan-phitsanulok"] },
  { id: "chaophraya", nameTh: "เจ้าพระยา", nameEn: "Chao Phraya", aliases: [], dams: ["200101", "200102", "100107", "100301"], points: ["chaophraya-nakhonsawan", "chaophraya-chainat", "chaophraya-ayutthaya"] },
  { id: "pasak", nameTh: "ป่าสัก", nameEn: "Pa Sak", aliases: [], dams: ["100301"], points: ["pasak-ayutthaya"] },
  { id: "sakaekrang", nameTh: "สะแกกรัง", nameEn: "Sakae Krang", aliases: [], dams: ["100302"], points: ["sakaekrang-uthaithani"] },
  { id: "thachin", nameTh: "ท่าจีน", nameEn: "Tha Chin", aliases: ["สุพรรณ", "Suphan"], dams: ["100303"], points: ["thachin-suphanburi"] },
  { id: "maeklong", nameTh: "แม่กลอง", nameEn: "Mae Klong", aliases: ["แควใหญ่", "Khwae Yai", "แควน้อย", "Khwae Noi"], dams: ["200401", "200402"], points: ["maeklong-ratchaburi"] },
  { id: "chi", nameTh: "ชี", nameEn: "Chi", aliases: [], dams: ["200205", "200204", "100206"], points: ["chi-yasothon"] },
  { id: "mun", nameTh: "มูล", nameEn: "Mun", aliases: ["Moon"], dams: ["100207", "100208", "100209", "100210", "100211", "200212"], points: ["mun-ubon"] },
  { id: "mekong", nameTh: "โขง", nameEn: "Mekong", aliases: ["Khong"], dams: ["100201", "100202", "200203"], points: ["mekong-nongkhai"] },
  { id: "songkhram", nameTh: "สงคราม", nameEn: "Songkhram", aliases: [], dams: ["100202"], points: ["songkhram-nakhonphanom"] },
  { id: "bangpakong", nameTh: "บางปะกง", nameEn: "Bang Pakong", aliases: [], dams: ["100501", "100502", "100514"], points: ["bangpakong-chachoengsao"] },
  { id: "phetchaburi", nameTh: "เพชรบุรี", nameEn: "Phetchaburi", aliases: [], dams: ["200601"], points: ["phetchaburi-mueang"] },
  { id: "pranburi", nameTh: "ปราณบุรี", nameEn: "Pran Buri", aliases: [], dams: ["100602"], points: ["pranburi-mueang"] },
  { id: "tapi", nameTh: "ตาปี", nameEn: "Tapi", aliases: ["พุมดวง", "Phum Duang"], dams: ["200603"], points: ["tapi-suratthani"] },
  { id: "pattani", nameTh: "ปัตตานี", nameEn: "Pattani", aliases: [], dams: ["200604"], points: ["pattani-yala"] },
];
