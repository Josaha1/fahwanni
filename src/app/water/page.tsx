import { MapBackLink } from "@/components/sheet/map-back-link";
import type { Metadata } from "next";
import { WaterPage } from "@/components/water/water-page";

export const metadata: Metadata = { title: "การระบายน้ำ · ฟ้าวันนี้" };

export default function Page() {
  return <><MapBackLink /><WaterPage /></>;
}
