import type { Metadata } from "next";
import { SettingsScreen } from "@/crm/ui/Admin";
import { requireSession } from "@/crm/server/page-auth";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function Page() {
  await requireSession();
  return <SettingsScreen />;
}
