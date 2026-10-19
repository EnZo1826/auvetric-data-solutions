import type { Metadata } from "next";
import { Suspense } from "react";
import { AuditScreen } from "@/crm/ui/Audit";
import { requireSession } from "@/crm/server/page-auth";

export const metadata: Metadata = { title: "Audit log" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const s = await requireSession();
  if (s.user.role !== "admin") return <div className="card" style={{ maxWidth: 560 }}><h1 style={{ marginTop: 0 }}>Audit log</h1><p className="muted" style={{ margin: 0 }}>Only admins can view the audit log.</p></div>;
  return <Suspense><AuditScreen /></Suspense>;
}
