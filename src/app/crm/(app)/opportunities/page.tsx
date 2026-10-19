import type { Metadata } from "next";
import { Suspense } from "react";
import { OpportunitiesScreen } from "@/crm/ui/Opportunities";
import { requireSession } from "@/crm/server/page-auth";

export const metadata: Metadata = { title: "Opportunities" };
export const dynamic = "force-dynamic";

export default async function Page() {
  await requireSession();
  return <Suspense><OpportunitiesScreen /></Suspense>;
}
