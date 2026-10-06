"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useT } from "@/i18n/client";
import { embedCode, lineShareUrl } from "./summary-card";

export function ShareExtras({ path, title, line = true }: { path: string; title: string; line?: boolean }) {
  const t = useT();
  const [code, setCode] = useState<string | null>(null);
  return <>
    {line && <button type="button" onClick={() => window.open(lineShareUrl(new URL(path, window.location.origin).href), "_blank", "noopener,noreferrer")}>{t("แชร์ไป LINE")}</button>}
    <button type="button" onClick={() => setCode(code ? null : embedCode(new URL(path, window.location.origin).href, title))}>{t("ฝังในเว็บอื่น")}</button>
    {code && <div className="w-full min-w-0">
      <label className="text-sm">{t("โค้ด iframe")}<textarea className="mt-2 w-full rounded border border-[var(--border)] p-2 text-xs" rows={5} readOnly value={code} onFocus={(event) => event.currentTarget.select()} /></label>
      <button type="button" className="min-h-11 px-3 text-sm" onClick={async () => {
        try { await navigator.clipboard.writeText(code); toast.success(t("คัดลอกแล้ว")); }
        catch { toast.error(t("คัดลอกไม่สำเร็จ")); }
      }}>{t("คัดลอกโค้ด")}</button>
    </div>}
  </>;
}
