"use client";
import Link from "next/link";
import { useT } from "@/i18n/client";

export function MapBackLink({ floating = false }: { floating?: boolean }) {
  const t = useT();
  return <Link href="/" className={floating ? "map-back-link map-back-link--floating" : "map-back-link"}>{t("‹ แผนที่น้ำ")}</Link>;
}
