import type { T } from "../i18n/core";
import type { Advice } from "./advise";

export function adviceText(advice: Advice, t: T): string {
  switch (advice.id) {
    case "umbrella": return t("พกร่มด้วย ฝนมีโอกาสตกใน 6 ชั่วโมงข้างหน้า");
    case "storm": return t("ระวังพายุฝนฟ้าคะนอง หลีกเลี่ยงที่โล่งแจ้ง");
    case "heat":
      if (advice.params?.band === "extreme") return t("อากาศร้อนอันตรายมาก อยู่ในที่ร่มและดื่มน้ำบ่อย ๆ");
      if (advice.params?.band === "danger") return t("อากาศร้อนอันตราย ดื่มน้ำบ่อย ๆ เลี่ยงแดดจัด");
      return t("อากาศร้อน ดื่มน้ำบ่อย ๆ และพักในที่ร่ม");
    case "uv": return t("แดดแรง ทาครีมกันแดดและหลบแดดช่วงเที่ยง");
    case "wind": return t("ลมกระโชกแรง ระวังสิ่งของปลิว");
    case "cooler": return t("พรุ่งนี้อากาศเย็นลง เตรียมเสื้อคลุม");
    case "sticky": return t("อากาศร้อนชื้น ดื่มน้ำและพักเป็นระยะ");
    case "raining-now": return t("ตอนนี้ฝนกำลังตก พกร่มถ้าต้องออกไปข้างนอก");
    case "rain-start": return t("ฝนน่าจะเริ่มตกราว {hour} น.", { hour: advice.params?.hour ?? "" });
    case "commute-rain": return t("ระวังฝนช่วงเดินทาง ราว {hour} น.", { hour: advice.params?.hour ?? "" });
    case "laundry-ok": return t("วันนี้ตากผ้าได้");
    case "laundry-no": return t("ไม่ควรตากผ้า อาจมีฝนหรืออากาศชื้น");
    case "exercise-ok": return t("วันนี้เหมาะกับการออกกำลังกายกลางแจ้ง");
    case "exercise-no": return t("เลี่ยงออกกำลังกายกลางแจ้ง อากาศอาจไม่ปลอดภัย");
    case "flood": return t("ฝนตกหนักต่อเนื่อง ระวังน้ำท่วมขัง");
    case "pm25":
      if (advice.params?.band === "affects-health") return t("ฝุ่น PM2.5 สูงมาก เลี่ยงกิจกรรมกลางแจ้งและใส่หน้ากาก N95");
      if (advice.params?.band === "starting-to-affect") return t("ฝุ่น PM2.5 เกินมาตรฐาน ใส่หน้ากาก N95");
      return t("ฝุ่น PM2.5 เริ่มสูง คนกลุ่มเสี่ยงควรลดกิจกรรมกลางแจ้ง");
    default: return "";
  }
}
