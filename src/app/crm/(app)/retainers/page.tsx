import type { Metadata } from "next";
import { RetainersScreen } from "@/crm/ui/Retainers";
import { requireSession } from "@/crm/server/page-auth";

export const metadata: Metadata = { title: "Retainers" };
export const dynamic = "force-dynamic";

export default async function Page() {
  await requireSession();
  return <RetainersScreen />;
}
