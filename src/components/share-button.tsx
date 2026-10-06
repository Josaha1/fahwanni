"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useT } from "@/i18n/client";
import type { AirSnapshot } from "@/lib/air";
import type { Place } from "@/lib/place";
import { buildFloodShareText, buildShareText, type FloodShareSummary } from "@/lib/share";
import type { WeatherSnapshot } from "@/lib/weather/types";
import { Menu } from "./ui/menu";
import { lineShareUrl, summaryCardText, type SummaryCard } from "./share/summary-card";

type ShareProps = { snapshot: WeatherSnapshot; air?: AirSnapshot; place: Place; flood?: never; text?: never; card?: never }
  | { flood: FloodShareSummary; snapshot?: never; air?: never; place?: never; text?: never; card?: never }
  | { text: string; flood?: never; snapshot?: never; air?: never; place?: never; card?: never }
  | { card: SummaryCard; text?: never; flood?: never; snapshot?: never; air?: never; place?: never };

export function ShareButton({ snapshot, air, place, flood, text, card, imageLabel }: ShareProps & { imageLabel?: string }) {
  const t = useT();
  const [making, setMaking] = useState(false);

  async function shareImage() {
    setMaking(true);
    try {
      const pageUrl = card ? new URL(card.path, window.location.origin).href : window.location.href;
      const blob = card
        ? await (await import("./share/render-summary-image")).renderSummaryImage(summaryCardText(card, pageUrl, t), t.locale)
        : text !== undefined
        ? await (await import("./share/render-summary-image")).renderSummaryImage(text, t.locale)
        : flood
        ? await (await import("./share/render-summary-image")).renderSummaryImage(buildFloodShareText(flood, t), t.locale)
        : await (await import("./share/render-share-image")).renderShareImage(snapshot!, air, place!, t);
      const file = new File([blob], "fah-wanni.png", { type: "image/png" });
      const payload = { files: [file], url: pageUrl };
      if (navigator.share && navigator.canShare?.(payload)) {
        try { await navigator.share(payload); return; }
        catch (error) {
          if (error instanceof Error && error.name === "AbortError") return;
        }
      }
      const url = URL.createObjectURL(blob);
      const link = Object.assign(document.createElement("a"), { href: url, download: "fah-wanni.png" });
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      toast.success(t("บันทึกรูปแล้ว"));
    } catch {
      toast.error(t("สร้างรูปไม่สำเร็จ"));
    } finally {
      setMaking(false);
    }
  }

  function shareText() {
    if (card) return summaryCardText(card, new URL(card.path, window.location.origin).href, t);
    return `${text ?? (flood ? buildFloodShareText(flood, t) : buildShareText(snapshot!, air, place!, t.locale, t))}\n${window.location.href}`;
  }

  async function share() {
    const text = shareText();
    if (navigator.share) {
      try { await navigator.share({ text }); }
      catch { /* The user can dismiss the native share sheet. */ }
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t("คัดลอกแล้ว"));
    } catch {
      toast.error(t("คัดลอกไม่ได้"));
    }
  }

  function shareLine() {
    const link = Object.assign(document.createElement("a"), {
      href: lineShareUrl(card ? new URL(card.path, window.location.origin).href : window.location.href),
      target: "_blank",
      rel: "noopener noreferrer",
    });
    link.click();
  }

  if (imageLabel) return <button type="button" disabled={making} onClick={() => void shareImage()}>{making ? t("กำลังสร้างรูป…") : imageLabel}</button>;

  return (
    <Menu label={t("แชร์")} items={[
      { label: t("แชร์ทาง LINE"), onSelect: shareLine },
      { label: t("แชร์ลิงก์"), onSelect: () => void share() },
      { label: making ? t("กำลังสร้างรูป…") : t("แชร์เป็นรูปภาพ"), onSelect: () => void shareImage(), disabled: making },
    ]} />
  );
}
