import { notFound } from "next/navigation";
import { damRegistryById } from "@/lib/dams/registry";
import { DamDetail } from "@/components/dams/dam-detail";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const registered = damRegistryById.get(id);
  if (!registered) notFound();
  return <DamDetail registered={registered} />;
}
