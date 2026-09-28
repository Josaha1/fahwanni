import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** The build currently serving requests; compared by open clients after a redeploy. */
export function GET() {
  return NextResponse.json({ buildId: process.env.NEXT_PUBLIC_BUILD_ID ?? null }, { headers: { "Cache-Control": "no-store" } });
}
