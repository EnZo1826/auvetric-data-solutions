import type { Metadata } from "next";
import { CompanyScreen } from "@/crm/ui/Admin";
import { requireSession } from "@/crm/server/page-auth";

export const metadata: Metadata = { title: "Company profile" };
export const dynamic = "force-dynamic";

export default async function Page() {
  await requireSession();
  return <CompanyScreen />;
}
