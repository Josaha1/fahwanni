import "server-only";

import { after } from "next/server";
import { fetchDams } from "@/lib/dams/client";
import { getDamTrend, refreshDamTrend } from "@/lib/dams/trend-source";
import { getFloodSnapshot } from "@/lib/flood/source";

/** Slow upstreams must not hold an iframe open; finish warming their shared cache after the response. */
async function bounded<T>(pending: Promise<T>): Promise<T | null> {
  const result = pending.catch(() => null);
  after(async () => { await result; });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([result, new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), 3000); })]);
  } finally {
    clearTimeout(timer);
  }
}

export async function damEmbedData() {
  const [dams, trend] = await Promise.all([bounded(fetchDams()), bounded(getDamTrend())]);
  if (trend?.stale) after(refreshDamTrend);
  return { dams, trend: trend?.trend ?? null };
}

export async function provinceEmbedData() {
  const [dams, flood] = await Promise.all([bounded(fetchDams()), bounded(getFloodSnapshot())]);
  return { dams, flood: flood?.snapshot?.payload ?? null };
}
