import type { Metadata } from "next";
import { Suspense } from "react";
import { ReportsScreen } from "@/crm/ui/Reports";
import { requireSession } from "@/crm/server/page-auth";

export const metadata: Metadata = { title: "Reports" };
export const dynamic = "force-dynamic";

export default async function Page() {
  await requireSession();
  return <Suspense><ReportsScreen /></Suspense>;
}
