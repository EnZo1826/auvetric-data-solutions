import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { DocEditor } from "@/crm/ui/DocEditor";
import { requireSession } from "@/crm/server/page-auth";

export const metadata: Metadata = { title: "Invoice" };
export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await params;
  if (id !== "new" && !/^\d{1,18}$/.test(id)) notFound();
  return <Suspense><DocEditor key={id} type="invoice" docId={id} /></Suspense>;
}
