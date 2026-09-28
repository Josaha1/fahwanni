import type { Place } from "./place";

type Province = { id: string; th: string; en: string; lat: number; lon: number };

// Coordinates point to the provincial capital, rounded to four decimal places.
export const provinces: Province[] = [
  { id: "bangkok", th: "กรุงเทพมหานคร", en: "Bangkok", lat: 13.7279, lon: 100.5241 },
  { id: "krabi", th: "กระบี่", en: "Krabi", lat: 8.0863, lon: 98.9063 },
  { id: "kanchanaburi", th: "กาญจนบุรี", en: "Kanchanaburi", lat: 14.0228, lon: 99.5328 },
  { id: "kalasin", th: "กาฬสินธุ์", en: "Kalasin", lat: 16.4314, lon: 103.5059 },
  { id: "kamphaeng-phet", th: "กำแพงเพชร", en: "Kamphaeng Phet", lat: 16.4828, lon: 99.5227 },
  { id: "khon-kaen", th: "ขอนแก่น", en: "Khon Kaen", lat: 16.4419, lon: 102.8360 },
  { id: "chanthaburi", th: "จันทบุรี", en: "Chanthaburi", lat: 12.6113, lon: 102.1039 },
  { id: "chachoengsao", th: "ฉะเชิงเทรา", en: "Chachoengsao", lat: 13.6904, lon: 101.0780 },
  { id: "chon-buri", th: "ชลบุรี", en: "Chon Buri", lat: 13.3611, lon: 100.9847 },
  { id: "chai-nat", th: "ชัยนาท", en: "Chai Nat", lat: 15.1852, lon: 100.1251 },
  { id: "chaiyaphum", th: "ชัยภูมิ", en: "Chaiyaphum", lat: 15.8068, lon: 102.0315 },
  { id: "chumphon", th: "ชุมพร", en: "Chumphon", lat: 10.4930, lon: 99.1800 },
  { id: "chiang-rai", th: "เชียงราย", en: "Chiang Rai", lat: 19.9072, lon: 99.8310 },
  { id: "chiang-mai", th: "เชียงใหม่", en: "Chiang Mai", lat: 18.7877, lon: 98.9931 },
  { id: "trang", th: "ตรัง", en: "Trang", lat: 7.5594, lon: 99.6110 },
  { id: "trat", th: "ตราด", en: "Trat", lat: 12.2428, lon: 102.5175 },
  { id: "tak", th: "ตาก", en: "Tak", lat: 16.8840, lon: 99.1258 },
  { id: "nakhon-nayok", th: "นครนายก", en: "Nakhon Nayok", lat: 14.2069, lon: 101.2131 },
  { id: "nakhon-pathom", th: "นครปฐม", en: "Nakhon Pathom", lat: 13.8199, lon: 100.0622 },
  { id: "nakhon-phanom", th: "นครพนม", en: "Nakhon Phanom", lat: 17.3920, lon: 104.7696 },
  { id: "nakhon-ratchasima", th: "นครราชสีมา", en: "Nakhon Ratchasima", lat: 14.9799, lon: 102.0978 },
  { id: "nakhon-si-thammarat", th: "นครศรีธรรมราช", en: "Nakhon Si Thammarat", lat: 8.4304, lon: 99.9631 },
  { id: "nakhon-sawan", th: "นครสวรรค์", en: "Nakhon Sawan", lat: 15.6930, lon: 100.1226 },
  { id: "nonthaburi", th: "นนทบุรี", en: "Nonthaburi", lat: 13.8621, lon: 100.5144 },
  { id: "narathiwat", th: "นราธิวาส", en: "Narathiwat", lat: 6.4255, lon: 101.8253 },
  { id: "nan", th: "น่าน", en: "Nan", lat: 18.7756, lon: 100.7730 },
  { id: "buri-ram", th: "บุรีรัมย์", en: "Buri Ram", lat: 14.9930, lon: 103.1029 },
  { id: "pathum-thani", th: "ปทุมธานี", en: "Pathum Thani", lat: 14.0208, lon: 100.5250 },
  { id: "prachuap-khiri-khan", th: "ประจวบคีรีขันธ์", en: "Prachuap Khiri Khan", lat: 11.8124, lon: 99.7973 },
  { id: "prachin-buri", th: "ปราจีนบุรี", en: "Prachin Buri", lat: 14.0510, lon: 101.3727 },
  { id: "pattani", th: "ปัตตานี", en: "Pattani", lat: 6.8695, lon: 101.2505 },
  { id: "phra-nakhon-si-ayutthaya", th: "พระนครศรีอยุธยา", en: "Phra Nakhon Si Ayutthaya", lat: 14.3532, lon: 100.5690 },
  { id: "phayao", th: "พะเยา", en: "Phayao", lat: 19.1665, lon: 99.9019 },
  { id: "phang-nga", th: "พังงา", en: "Phang Nga", lat: 8.4407, lon: 98.5193 },
  { id: "phatthalung", th: "พัทลุง", en: "Phatthalung", lat: 7.6167, lon: 100.0740 },
  { id: "phichit", th: "พิจิตร", en: "Phichit", lat: 16.4430, lon: 100.3482 },
  { id: "phitsanulok", th: "พิษณุโลก", en: "Phitsanulok", lat: 16.8298, lon: 100.2615 },
  { id: "phetchaburi", th: "เพชรบุรี", en: "Phetchaburi", lat: 13.1112, lon: 99.9391 },
  { id: "phetchabun", th: "เพชรบูรณ์", en: "Phetchabun", lat: 16.4190, lon: 101.1551 },
  { id: "phrae", th: "แพร่", en: "Phrae", lat: 18.1446, lon: 100.1403 },
  { id: "phuket", th: "ภูเก็ต", en: "Phuket", lat: 7.9810, lon: 98.3639 },
  { id: "maha-sarakham", th: "มหาสารคาม", en: "Maha Sarakham", lat: 16.1851, lon: 103.3026 },
  { id: "mukdahan", th: "มุกดาหาร", en: "Mukdahan", lat: 16.5424, lon: 104.7209 },
  { id: "mae-hong-son", th: "แม่ฮ่องสอน", en: "Mae Hong Son", lat: 19.2991, lon: 97.9656 },
  { id: "yasothon", th: "ยโสธร", en: "Yasothon", lat: 15.7926, lon: 104.1453 },
  { id: "yala", th: "ยะลา", en: "Yala", lat: 6.5411, lon: 101.2804 },
  { id: "roi-et", th: "ร้อยเอ็ด", en: "Roi Et", lat: 16.0538, lon: 103.6520 },
  { id: "ranong", th: "ระนอง", en: "Ranong", lat: 9.9529, lon: 98.6085 },
  { id: "rayong", th: "ระยอง", en: "Rayong", lat: 12.6833, lon: 101.2374 },
  { id: "ratchaburi", th: "ราชบุรี", en: "Ratchaburi", lat: 13.5283, lon: 99.8134 },
  { id: "lop-buri", th: "ลพบุรี", en: "Lop Buri", lat: 14.7995, lon: 100.6534 },
  { id: "lampang", th: "ลำปาง", en: "Lampang", lat: 18.2888, lon: 99.4909 },
  { id: "lamphun", th: "ลำพูน", en: "Lamphun", lat: 18.5745, lon: 99.0087 },
  { id: "loei", th: "เลย", en: "Loei", lat: 17.4860, lon: 101.7223 },
  { id: "si-sa-ket", th: "ศรีสะเกษ", en: "Si Sa Ket", lat: 15.1186, lon: 104.3220 },
  { id: "sakon-nakhon", th: "สกลนคร", en: "Sakon Nakhon", lat: 17.1546, lon: 104.1348 },
  { id: "songkhla", th: "สงขลา", en: "Songkhla", lat: 7.1756, lon: 100.6143 },
  { id: "satun", th: "สตูล", en: "Satun", lat: 6.6238, lon: 100.0674 },
  { id: "samut-prakan", th: "สมุทรปราการ", en: "Samut Prakan", lat: 13.5991, lon: 100.5998 },
  { id: "samut-songkhram", th: "สมุทรสงคราม", en: "Samut Songkhram", lat: 13.4098, lon: 100.0023 },
  { id: "samut-sakhon", th: "สมุทรสาคร", en: "Samut Sakhon", lat: 13.5475, lon: 100.2744 },
  { id: "sa-kaeo", th: "สระแก้ว", en: "Sa Kaeo", lat: 13.8240, lon: 102.0646 },
  { id: "saraburi", th: "สระบุรี", en: "Saraburi", lat: 14.5289, lon: 100.9101 },
  { id: "sing-buri", th: "สิงห์บุรี", en: "Sing Buri", lat: 14.8936, lon: 100.3967 },
  { id: "sukhothai", th: "สุโขทัย", en: "Sukhothai", lat: 17.0056, lon: 99.8264 },
  { id: "suphan-buri", th: "สุพรรณบุรี", en: "Suphan Buri", lat: 14.4745, lon: 100.1177 },
  { id: "surat-thani", th: "สุราษฎร์ธานี", en: "Surat Thani", lat: 9.1382, lon: 99.3217 },
  { id: "surin", th: "สุรินทร์", en: "Surin", lat: 14.8829, lon: 103.4937 },
  { id: "nong-khai", th: "หนองคาย", en: "Nong Khai", lat: 17.8783, lon: 102.7413 },
  { id: "nong-bua-lam-phu", th: "หนองบัวลำภู", en: "Nong Bua Lam Phu", lat: 17.2218, lon: 102.4260 },
  { id: "ang-thong", th: "อ่างทอง", en: "Ang Thong", lat: 14.5896, lon: 100.4551 },
  { id: "amnat-charoen", th: "อำนาจเจริญ", en: "Amnat Charoen", lat: 15.8657, lon: 104.6258 },
  { id: "udon-thani", th: "อุดรธานี", en: "Udon Thani", lat: 17.4138, lon: 102.7872 },
  { id: "uttaradit", th: "อุตรดิตถ์", en: "Uttaradit", lat: 17.6201, lon: 100.0993 },
  { id: "uthai-thani", th: "อุทัยธานี", en: "Uthai Thani", lat: 15.3835, lon: 100.0246 },
  { id: "ubon-ratchathani", th: "อุบลราชธานี", en: "Ubon Ratchathani", lat: 15.2287, lon: 104.8564 },
  { id: "bueng-kan", th: "บึงกาฬ", en: "Bueng Kan", lat: 18.3609, lon: 103.6464 },
];

export function searchProvinces(q: string, limit = 8): Place[] {
  const query = q.trim().replace(/^จังหวัด/, "").trim().toLocaleLowerCase();
  if (!query || limit <= 0) return [];

  return provinces
    .map((province, index) => {
      const th = province.th.toLocaleLowerCase();
      const en = province.en.toLocaleLowerCase();
      const prefix = th.startsWith(query) || en.startsWith(query);
      const substring = th.includes(query) || en.includes(query);
      return { province, index, rank: prefix ? 0 : substring ? 1 : 2 };
    })
    .filter(({ rank }) => rank < 2)
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .slice(0, limit)
    .map(({ province }) => ({
      id: province.id,
      name: province.th,
      admin: province.en,
      country: "Thailand",
      lat: province.lat,
      lon: province.lon,
      source: "province" as const,
    }));
}
