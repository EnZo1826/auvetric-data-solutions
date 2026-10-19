import type { Metadata } from "next";
import { Suspense } from "react";
import { TasksScreen } from "@/crm/ui/Tasks";
import { requireSession } from "@/crm/server/page-auth";

export const metadata: Metadata = { title: "Tasks" };
export const dynamic = "force-dynamic";

export default async function Page() {
  await requireSession();
  return <Suspense><TasksScreen /></Suspense>;
}
