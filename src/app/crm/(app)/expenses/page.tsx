import type { Metadata } from "next";
import { Suspense } from "react";
import { ExpensesScreen } from "@/crm/ui/Expenses";
import { requireSession } from "@/crm/server/page-auth";

export const metadata: Metadata = { title: "Expenses" };
export const dynamic = "force-dynamic";

export default async function Page() {
  await requireSession();
  return <Suspense><ExpensesScreen /></Suspense>;
}
