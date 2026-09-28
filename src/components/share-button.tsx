"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useT } from "@/i18n/client";
import type { AirSnapshot } from "@/lib/air";
import type { Place } from "@/lib/place";
import { buildShareText } from "@/lib/share";
import type { WeatherSnapshot } from "@/lib/weather/types";
import { renderShareImage } from "./share/render-share-image";

export function ShareButton({ snapshot, air, place }: { snapshot: WeatherSnapshot; air?: AirSnapshot; place: Place }) {
  const t = useT();
  const [making, setMaking] = useState(false);

  async function shareImage() {
    setMaking(true);
    try {
      const blob = await renderShareImage(snapshot, air, place, t);
      const file = new File([blob], "fah-wanni.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ files: [file] }); } catch { /* dismissed */ }
      } else {
        const url = URL.createObjectURL(blob);
        const link = Object.assign(document.createElement("a"), { href: url, download: "fah-wanni.png" });
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
        toast.success(t("บันทึกรูปแล้ว"));
      }
    } catch {
      toast.error(t("สร้างรูปไม่สำเร็จ"));
    } finally {
      setMaking(false);
    }
  }

  function shareText() {
    return `${buildShareText(snapshot, air, place, t.locale, t)}\n${window.location.href}`;
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

  return (
    <div className="flex flex-wrap gap-2">
      <a href="https://line.me/R/share" target="_blank" rel="noopener noreferrer"
        onClick={(event) => { event.currentTarget.href = `https://line.me/R/share?text=${encodeURIComponent(shareText())}`; }}
        className="flex min-h-11 items-center rounded-xl border border-border bg-card px-4 text-sm font-semibold text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-given">
        {t("แชร์ทาง LINE")}
      </a>
      <button type="button" onClick={share}
        className="min-h-11 rounded-xl border border-border bg-card px-4 text-sm font-semibold text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-given">
        {t("แชร์")}
      </button>
      <button type="button" onClick={shareImage} disabled={making}
        className="min-h-11 rounded-xl border border-border bg-card px-4 text-sm font-semibold text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-given disabled:opacity-60">
        {making ? t("กำลังสร้างรูป…") : t("แชร์เป็นรูปภาพ")}
      </button>
    </div>
  );
}
