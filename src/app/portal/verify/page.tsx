import type { Metadata } from "next";
import { PortalVerify } from "@/crm/ui/Portal";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

/** The emailed link lands here; signing in needs a button press so mail scanners that open links can't use them up. */
export default async function Page({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t = "" } = await searchParams;
  return <div className="card portal-narrow"><PortalVerify token={t} /></div>;
}
