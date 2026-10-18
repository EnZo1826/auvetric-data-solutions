import type { Metadata } from "next";
import { ServicesScreen } from "@/crm/ui/Services";
import { requireSession } from "@/crm/server/page-auth";

export const metadata: Metadata = { title: "Services" };
export const dynamic = "force-dynamic";

export default async function Page() {
  await requireSession();
  return <ServicesScreen />;
}
