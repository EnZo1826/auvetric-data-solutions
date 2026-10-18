import type { Metadata } from "next";
import { ClientsScreen } from "@/crm/ui/Clients";
import { requireSession } from "@/crm/server/page-auth";

export const metadata: Metadata = { title: "Clients & Contacts" };
export const dynamic = "force-dynamic";

export default async function Page() {
  await requireSession();
  return <ClientsScreen />;
}
