"use client";

import { useT } from "@/i18n/client";
import { capacityColor } from "@/components/dams/dam-hero";
import { damRegistryById } from "@/lib/dams/registry";
import type { Dam } from "@/lib/dams/types";
import { provinces } from "@/lib/provinces";
import { flowBucket, flowColorRole } from "@/lib/map/flow-scale";
import { sumRelease } from "@/lib/rivers/observed";
import type { ObservedRelease, RiverSystem } from "@/lib/rivers/types";
import { schematicFlowWidth, schematicLabels, schematicNodes } from "./river-layout";
import type { ProvinceGauge } from "./river-detail";

export function RiverSchematic({ system, dams, gauges, animate = false }: {
  system: RiverSystem; dams: Dam[]; gauges: ProvinceGauge[]; animate?: boolean;
}) {
  const t = useT();
  const number = new Intl.NumberFormat(t.intl, { maximumFractionDigits: 1 });
  const value = (n: number | null | undefined) => n == null ? t("ไม่รายงาน") : number.format(n);
  const displayNodes = schematicNodes(system);
  const nodes = new Map(displayNodes.map((node) => [node.id, node]));
  const byDam = new Map(dams.map((dam) => [dam.id, dam]));
  const nodeName = (node: typeof displayNodes[number]) => {
    const registered = node.damId ? damRegistryById.get(node.damId) : undefined;
    const province = provinces.find((entry) => entry.id === node.provinceId);
    return registered ? t.locale === "en" ? registered.nameEn : registered.nameTh
      : node.kind === "province" && province ? t.locale === "en" ? province.en : province.th
      : t(node.kind === "sea" ? node.id.includes("south-china-sea") ? "ทะเลจีนใต้" : "อ่าวไทย" : "จุดบรรจบแม่น้ำ");
  };
  const labels = new Map(schematicLabels(displayNodes.filter((node) => node.kind !== "confluence").map((node) => ({
    node, name: nodeName(node), release: node.damId ? value(byDam.get(node.damId)?.releaseCms) : undefined,
  })), displayNodes).map((label) => [label.id, label]));
  const height = Math.max(...displayNodes.map((node) => node.y), ...[...labels.values()].map((label) => label.y + label.height)) + 24;
  return <svg className="river-schematic" viewBox={`-20 0 420 ${height}`} width="100%" role="group" aria-label={t("ผังลุ่มน้ำ {name} · การระบายจากเขื่อน", { name: t.locale === "en" ? system.en : system.th })} data-animate={animate}>
    {system.edges.map((edge) => {
      const from = nodes.get(edge.from)!;
      const to = nodes.get(edge.to)!;
      const release: ObservedRelease | null = sumRelease(edge.damIds, dams, null);
      const total = release?.today?.totalCms ?? null;
      const missing = release?.today?.missing.length ?? edge.damIds.length;
      const bucket = flowBucket(total);
      const midY = (from.y + to.y) / 2;
      return <g key={`${edge.from}:${edge.to}`} data-edge={`${edge.from}:${edge.to}`}>
        <title>{`${t("ระบาย")} ${value(total)} ${t("ลบ.ม./วินาที")}${missing > 0 ? ` · ${t("ขาด {n} เขื่อน", { n: missing })}` : ""}${release?.today ? ` · ${t("กรมชลประทาน")} ${release.today.date}` : ""}`}</title>
        <polyline className="river-flow" points={`${from.x},${from.y} ${from.x},${midY} ${to.x},${midY} ${to.x},${to.y}`}
          fill="none" stroke={`var(--${flowColorRole(total)})`} strokeWidth={schematicFlowWidth(total)} strokeLinecap="round"
          // Grey only when no upstream dam reported; a partial sum keeps its colour with a lighter, longer dash.
          strokeDasharray={total === null ? "1 5" : missing > 0 ? "8 4" : "3 5"} strokeOpacity={total !== null && missing > 0 ? 0.7 : 1}
          data-bucket={total === null ? "none" : bucket} data-partial={total !== null && missing > 0 ? "true" : undefined} />
      </g>;
    })}
    {displayNodes.map((node) => {
      const dam = node.damId ? byDam.get(node.damId) : undefined;
      const registered = node.damId ? damRegistryById.get(node.damId) : undefined;
      const name = nodeName(node);
      const label = labels.get(node.id);
      const matching = node.kind === "province" ? gauges.filter((gauge) => gauge.provinceId === node.provinceId) : [];
      const title = registered ? `${name} · ${value(dam?.storagePct)}% · ${t("ระบาย")} ${value(dam?.releaseCms)} ${t("ลบ.ม./วินาที")} · ${t("กรมชลประทาน")} · ${dam?.date ?? t("ไม่ทราบวันที่ข้อมูล")}` : name;
      const content = <g data-node={node.id}>
        <title>{title}</title>
        {node.kind !== "confluence" && <circle cx={node.x} cy={node.y} r={node.kind === "dam" ? 9 : node.kind === "province" ? 6 : 4} fill={node.kind === "province" ? "var(--foreground)" : "var(--background)"} stroke={node.kind === "dam" ? capacityColor(dam?.storagePct) : "var(--foreground)"} strokeWidth={node.kind === "dam" ? 4 : 2} />}
        {label && <>
          <text x={label.textX} y={label.nameY} textAnchor={label.anchor} className="river-label">{name}</text>
          {registered && <text x={label.textX} y={label.releaseY} textAnchor={label.anchor} className="river-release">{value(dam?.releaseCms)}</text>}
        </>}
        {matching.map((gauge, index) => {
          const y = node.y - 5 + index * 4;
          const month = new Intl.DateTimeFormat(t.intl, { month: "short", year: "numeric", timeZone: "Asia/Bangkok" }).format(new Date(`${gauge.month}-01T00:00:00+07:00`));
          return <g key={gauge.code} data-gauge={gauge.code}>
            <title>{`${t.locale === "en" ? gauge.nameEn : gauge.name} · HII (CC BY-NC) · ${month} · ${t("ระดับเฉลี่ย {n} ม.รทก.", { n: value(gauge.levelMsl.mean) })}`}</title>
            <line x1={node.x + 9} x2={node.x + 14} y1={y} y2={y} stroke="var(--nodata)" strokeWidth="2" />
          </g>;
        })}
      </g>;
      const href = node.damId ? `/dam/${node.damId}` : node.kind === "province" ? `/?province=${node.provinceId}` : null;
      return href ? <a key={node.id} href={href} aria-label={title}>{content}</a> : <g key={node.id}>{content}</g>;
    })}
  </svg>;
}
