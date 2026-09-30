"use client";

import { useEffect } from "react";
import Link from "next/link";
import { reportClientError } from "@/lib/client-error-log";

export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => { reportClientError(error, "global"); }, [error]);

  return <html lang="th"><body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "system-ui, sans-serif", colorScheme: "light dark" }}>
    <main style={{ padding: 24, textAlign: "center" }}>
      <h1>เกิดข้อผิดพลาด</h1>
      <button type="button" onClick={retry} style={{ minHeight: 44, padding: "0 20px", cursor: "pointer" }}>ลองใหม่</button>
      <p><Link href="/">กลับหน้าแรก</Link></p>
    </main>
  </body></html>;
}
