/** Page-side guard for /portal server components. */
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { PORTAL_COOKIE, readPortalSession, type PortalSession } from "./portal";

export const currentPortal = cache(async (): Promise<PortalSession | null> => readPortalSession((await cookies()).get(PORTAL_COOKIE)?.value));

export async function requirePortal(): Promise<PortalSession> {
  const s = await currentPortal();
  if (!s) redirect("/portal/login");
  return s;
}

export async function pageIp() {
  const h = await headers();
  return (h.get("x-nf-client-connection-ip") || h.get("x-forwarded-for")?.split(",")[0]?.trim() || "local").slice(0, 64);
}
