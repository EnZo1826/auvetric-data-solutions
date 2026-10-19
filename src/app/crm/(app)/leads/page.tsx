import type { Metadata } from "next";
import { Suspense } from "react";
import { LeadsBoard } from "@/crm/ui/Leads";
import { requireSession } from "@/crm/server/page-auth";

export const metadata: Metadata = { title: "Leads" };
export const dynamic = "force-dynamic";

export default async function Page() {
  await requireSession();
  return <Suspense><LeadsBoard /></Suspense>;
}
