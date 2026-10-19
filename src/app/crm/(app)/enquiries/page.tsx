import type { Metadata } from "next";
import { Suspense } from "react";
import { EnquiriesScreen } from "@/crm/ui/Enquiries";
import { requireSession } from "@/crm/server/page-auth";

export const metadata: Metadata = { title: "Enquiries" };
export const dynamic = "force-dynamic";

export default async function Page() {
  await requireSession();
  return <Suspense><EnquiriesScreen /></Suspense>;
}
