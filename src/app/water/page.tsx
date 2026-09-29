import type { Metadata } from "next";
import { WaterPage } from "@/components/water/water-page";

export const metadata: Metadata = { title: "สถานการณ์น้ำ · ฟ้าวันนี้" };

export default function Page() {
  return <WaterPage />;
}
