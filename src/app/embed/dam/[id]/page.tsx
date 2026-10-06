import { notFound } from "next/navigation";
import { getT } from "@/i18n/server";
import { damRegistryById } from "@/lib/dams/registry";
import { damEmbedData } from "@/components/share/embed-data";
import { damSummaryCard } from "@/components/share/summary-card";
import { EmbedCard } from "@/components/share/embed-card";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const registered = damRegistryById.get(id);
  if (!registered) notFound();
  const [t, { dams, trend }] = await Promise.all([getT(), damEmbedData()]);
  return <EmbedCard card={damSummaryCard(registered, dams?.dams.find((dam) => dam.id === id), trend, t)} t={t} />;
}
