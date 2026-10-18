import type { Metadata } from "next";
import { UsersScreen } from "@/crm/ui/Admin";
import { requireSession } from "@/crm/server/page-auth";

export const metadata: Metadata = { title: "Users" };
export const dynamic = "force-dynamic";

export default async function Page() {
  await requireSession();
  return <UsersScreen />;
}
