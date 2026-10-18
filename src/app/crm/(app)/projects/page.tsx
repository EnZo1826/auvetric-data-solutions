import type { Metadata } from "next";
import { Suspense } from "react";
import { ProjectsBoard } from "@/crm/ui/Projects";
import { requireSession } from "@/crm/server/page-auth";

export const metadata: Metadata = { title: "Projects" };
export const dynamic = "force-dynamic";

export default async function Page() {
  await requireSession();
  return <Suspense><ProjectsBoard /></Suspense>;
}
