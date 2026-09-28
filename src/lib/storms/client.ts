import "server-only";

import { targetTcSchema, parseJmaStorm } from "./jma";
import { parseGdacsStorms } from "./gdacs";
import { mergeStorms, type Storm } from "./normalize";

export type StormSnapshot = {
  active: boolean;
  storms: Storm[];
  sources: { jma: "ok" | "error"; gdacs: "ok" | "error" };
  updatedAt: string;
};

async function getJson(url: string, fetchImpl: typeof fetch): Promise<unknown> {
  const response = await fetchImpl(url, { next: { revalidate: 900 }, signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`Storm source returned ${response.status}`);
  return response.json();
}

async function fetchJma(fetchImpl: typeof fetch): Promise<Storm[]> {
  const targets = targetTcSchema.parse(await getJson("https://www.jma.go.jp/bosai/typhoon/data/targetTc.json", fetchImpl));
  const storms = await Promise.allSettled(targets.filter((target) => target.tropicalCyclone).map(async (target) => {
    const base = `https://www.jma.go.jp/bosai/typhoon/data/${encodeURIComponent(target.tropicalCyclone!)}`;
    const [forecast, specifications] = await Promise.all([
      getJson(`${base}/forecast.json`, fetchImpl),
      getJson(`${base}/specifications.json`, fetchImpl),
    ]);
    return parseJmaStorm(target, forecast, specifications);
  }));
  if (storms.some((result) => result.status === "rejected")) throw new Error("JMA cyclone detail failed");
  return storms.flatMap((result) => result.status === "fulfilled" && result.value ? [result.value] : []);
}

async function fetchGdacs(fetchImpl: typeof fetch, now: Date): Promise<Storm[]> {
  const url = new URL("https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH");
  const day = (date: Date) => date.toISOString().slice(0, 10);
  url.searchParams.set("eventlist", "TC");
  url.searchParams.set("fromDate", day(new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000)));
  url.searchParams.set("toDate", day(now));
  return parseGdacsStorms(await getJson(url.toString(), fetchImpl), now);
}

export async function fetchStorms(fetchImpl: typeof fetch = fetch, now = new Date()): Promise<StormSnapshot> {
  const [jma, gdacs] = await Promise.allSettled([fetchJma(fetchImpl), fetchGdacs(fetchImpl, now)]);
  const storms = mergeStorms(jma.status === "fulfilled" ? jma.value : [], gdacs.status === "fulfilled" ? gdacs.value : []);
  return {
    active: storms.length > 0,
    storms,
    sources: { jma: jma.status === "fulfilled" ? "ok" : "error", gdacs: gdacs.status === "fulfilled" ? "ok" : "error" },
    updatedAt: now.toISOString(),
  };
}
