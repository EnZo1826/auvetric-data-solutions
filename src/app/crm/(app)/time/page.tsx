import type { Metadata } from "next";
import { Suspense } from "react";
import { TimeScreen } from "@/crm/ui/Time";
import { requireSession } from "@/crm/server/page-auth";

export const metadata: Metadata = { title: "Time" };
export const dynamic = "force-dynamic";

export default async function Page() {
  await requireSession();
  return <Suspense><TimeScreen /></Suspense>;
}
