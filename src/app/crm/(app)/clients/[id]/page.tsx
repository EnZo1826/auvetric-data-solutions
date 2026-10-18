import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ClientDetail } from "@/crm/ui/Clients";
import { requireSession } from "@/crm/server/page-auth";

export const metadata: Metadata = { title: "Client" };
export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await params;
  if (!/^\d{1,18}$/.test(id)) notFound();
  return <ClientDetail key={id} id={id} />;
}
