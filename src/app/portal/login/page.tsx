import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentPortal } from "@/crm/server/portal-page";
import { PortalLogin } from "@/crm/ui/Portal";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  if (await currentPortal()) redirect("/portal");
  const { email = "" } = await searchParams;
  return <div className="card portal-narrow"><PortalLogin initialEmail={email.slice(0, 254)} /></div>;
}
