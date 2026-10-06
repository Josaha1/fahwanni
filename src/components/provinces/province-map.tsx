"use client";

import { useId } from "react";
import { useT } from "@/i18n/client";
import { thProvinces, thProjection } from "@/lib/visuals/th-provinces";
import type { Bbox } from "@/lib/water/flood-risk";
import type { FloodReport } from "@/lib/map/gibs-replay";
import type { Province } from "./data";

export function ProvinceMap({ province, bbox, report }: { province: Province; bbox: Bbox; report?: FloodReport }) {
  const t = useT();
  const clip = useId().replaceAll(":", "");
  const project = (lon: number, lat: number) => [(lon - thProjection.west) * thProjection.cosLat * thProjection.scale, (thProjection.north - lat) * thProjection.scale];
  const [x, y] = project(bbox[0], bbox[3]);
  const [right, bottom] = project(bbox[2], bbox[1]);
  const width = right - x, height = bottom - y, pad = Math.max(width, height) * 0.12;
  const shape = thProvinces.find((entry) => entry.id === province.id)!;
  const image = report ? `https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.1.1&LAYERS=${report.layer}&SRS=EPSG:4326&BBOX=${bbox.join(",")}&WIDTH=512&HEIGHT=512&FORMAT=image/png&TRANSPARENT=true&TIME=${report.date}` : undefined;
  return <svg className="province-map" viewBox={`${x - pad} ${y - pad} ${width + 2 * pad} ${height + 2 * pad}`} role="img" aria-label={t("แผนที่จังหวัด {name}", { name: t.locale === "en" ? province.en : province.th })}>
    <defs><clipPath id={clip}><path d={shape.d} /></clipPath></defs>
    {thProvinces.map((entry) => <path key={entry.id} d={entry.d} fill={entry.id === province.id ? "var(--water)" : "var(--card)"} fillOpacity={entry.id === province.id ? 0.18 : 1} stroke={entry.id === province.id ? "var(--water)" : "var(--border)"} strokeWidth="0.6"><title>{entry.id === province.id ? t.locale === "en" ? province.en : province.th : entry.id}</title></path>)}
    {image && <image href={image} x={x} y={y} width={width} height={height} preserveAspectRatio="none" clipPath={`url(#${clip})`} />}
  </svg>;
}
