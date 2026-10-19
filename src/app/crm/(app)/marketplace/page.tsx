import type { Metadata } from "next";
import { Suspense } from "react";
import { MarketplaceScreen } from "@/crm/ui/Marketplace";
import { requireSession } from "@/crm/server/page-auth";

export const metadata: Metadata = { title: "Marketplace earnings" };
export const dynamic = "force-dynamic";

export default async function Page() {
  await requireSession();
  return <Suspense><MarketplaceScreen /></Suspense>;
}
