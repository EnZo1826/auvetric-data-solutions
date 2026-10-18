import type { Metadata } from "next";
import { DocList } from "@/crm/ui/DocList";
import { requireSession } from "@/crm/server/page-auth";

export const metadata: Metadata = { title: "Invoices" };
export const dynamic = "force-dynamic";

export default async function Page() {
  await requireSession();
  return <DocList type="invoice" />;
}
