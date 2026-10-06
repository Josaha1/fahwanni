import { notFound } from "next/navigation";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { provinces } from "@/lib/provinces";
import { prepareProvinceMask, type ProvinceGeoJson } from "@/lib/flood/mask";
import { ProvinceDetail } from "@/components/provinces/province-detail";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const province = provinces.find((entry) => entry.id === id);
  if (!province) notFound();
  const geo = JSON.parse(await readFile(join(process.cwd(), "public/data/th-provinces-adm1.geojson"), "utf8")) as ProvinceGeoJson;
  const bbox = prepareProvinceMask(geo).find((entry) => entry.id === id)!.bbox;
  return <ProvinceDetail key={id} province={province} bbox={bbox} />;
}
