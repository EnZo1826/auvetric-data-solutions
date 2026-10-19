import type { Metadata } from "next";
import { Suspense } from "react";
import { IntegrationsScreen } from "@/crm/ui/Integrations";
import { requireSession } from "@/crm/server/page-auth";

export const metadata: Metadata = { title: "Integrations" };
export const dynamic = "force-dynamic";

export default async function Page() {
  await requireSession();
  return <Suspense><IntegrationsScreen /></Suspense>;
}
