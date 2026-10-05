import type { Metadata } from "next";
import { WeatherApp } from "@/components/weather-app";

export const metadata: Metadata = { title: "ฝน · ฟ้าวันนี้" };

export default function Page() {
  return <WeatherApp />;
}
