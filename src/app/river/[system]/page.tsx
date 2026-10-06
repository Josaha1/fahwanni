import { notFound } from "next/navigation";
import { RiverDetail } from "@/components/rivers/river-detail";
import { riverSystems } from "@/lib/rivers/systems";
import pointsData from "../../../../public/data/river-points.json";
import observedData from "../../../../public/data/observed-points.json";
import hii from "../../../../public/data/hii-gauges.json";

export default async function Page({ params }: { params: Promise<{ system: string }> }) {
  const { system: id } = await params;
  const system = riverSystems.find((entry) => entry.id === id);
  if (!system) notFound();
  const gauges = [...pointsData.points, ...observedData.points].flatMap((point) => {
    const gauge = (hii.gauges as Record<string, (typeof hii.gauges)[keyof typeof hii.gauges]>)[point.id];
    return gauge && system.nodes.some((node) => node.kind === "province" && node.provinceId === point.provinceId)
      ? [{ ...gauge, month: hii.month, provinceId: point.provinceId, nameEn: point.nameEn }] : [];
  });
  return <RiverDetail system={system} gauges={gauges} />;
}
