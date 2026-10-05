import { DAM_REGISTRY } from "@/lib/dams/registry";
import { previousDate } from "@/lib/dams/pillar";
import type { DamTrend } from "@/lib/dams/trend";
import type { Dam } from "@/lib/dams/types";
import { streamRate, tankFill } from "@/lib/visuals";

export function tankGridData(dams: readonly Dam[], date: string | null, trend: DamTrend | null) {
  const reports = new Map(dams.filter((dam) => date !== null && dam.date === date).map((dam) => [dam.id, dam]));
  const yesterday = date ? trend?.dates.indexOf(previousDate(date)) ?? -1 : -1;
  return DAM_REGISTRY.map((registered) => {
    const dam = reports.get(registered.id);
    const fill = tankFill(dam?.storagePct ?? null, 121);
    const release = streamRate(dam?.releaseCms ?? null, "cms", 1000);
    const inflow = streamRate(dam?.inflowCms ?? null, "cms", 1000);
    const previous = trend?.pct[registered.id]?.[yesterday];
    const change = fill.state === "data" && previous != null && Number.isFinite(previous) ? fill.value - previous : null;
    return { ...registered, fill, release, inflow, change,
      state: { id: registered.id, pct: fill.state === "data" ? fill.value : null,
        release: release.state === "data" ? release.value : null, inflow: inflow.state === "data" ? inflow.value : null } };
  });
}

export type TankEntry = ReturnType<typeof tankGridData>[number];
