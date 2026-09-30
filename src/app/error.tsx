"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useT } from "@/i18n/client";
import { reportClientError } from "@/lib/client-error-log";

export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const t = useT();
  useEffect(() => { reportClientError(error, "route"); }, [error]);

  return <main className="mx-auto flex min-h-[70vh] max-w-lg items-center px-4">
    <section className="placeholder-card w-full p-6 text-center">
      <h1 className="text-xl font-semibold">{t("เกิดข้อผิดพลาด")}</h1>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
        <button type="button" className="btn-primary min-h-11 px-5" onClick={retry}>{t("ลองใหม่")}</button>
        <Link href="/" className="inline-flex min-h-11 items-center px-4 underline">{t("กลับหน้าแรก")}</Link>
      </div>
    </section>
  </main>;
}
