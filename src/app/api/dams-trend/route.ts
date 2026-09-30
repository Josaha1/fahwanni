import { after } from "next/server";
import { getDamTrend, refreshDamTrend } from "@/lib/dams/trend-source";

const headers = { "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400" };

export async function GET() {
  const result = await getDamTrend();
  if (!result) return Response.json({ error: "upstream" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  if (result.stale) after(refreshDamTrend);
  return Response.json(result.trend, { headers });
}
