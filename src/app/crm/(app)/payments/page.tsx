import type { Metadata } from "next";
import { Suspense } from "react";
import { PaymentsScreen } from "@/crm/ui/Payments";
import { requireSession } from "@/crm/server/page-auth";

export const metadata: Metadata = { title: "Payments" };
export const dynamic = "force-dynamic";

export default async function Page() {
  await requireSession();
  return <Suspense><PaymentsScreen /></Suspense>;
}
