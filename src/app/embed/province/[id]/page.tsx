import { notFound } from "next/navigation";
import { getT } from "@/i18n/server";
import { provinces } from "@/lib/provinces";
import { provinceEmbedData } from "@/components/share/embed-data";
import { provinceSummaryCard } from "@/components/share/summary-card";
import { EmbedCard } from "@/components/share/embed-card";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const province = provinces.find((entry) => entry.id === id);
  if (!province) notFound();
  const [t, { dams, flood }] = await Promise.all([getT(), provinceEmbedData()]);
  return <EmbedCard card={provinceSummaryCard(province, flood?.provinceCounts[id], flood?.date, dams?.dams, t)} t={t} />;
}
