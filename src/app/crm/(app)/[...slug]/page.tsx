import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/crm/server/page-auth";
import { findItem, isBuilt } from "@/crm/nav";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string[] }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return { title: findItem(slug[0])?.label ?? "Not found" };
}

/** Placeholder for modules scheduled in later phases, so the full navigation is visible from day one. */
export default async function Scheduled({ params }: Props) {
  await requireSession();
  const { slug } = await params;
  const item = slug.length === 1 ? findItem(slug[0]) : undefined;
  if (!item || isBuilt(item.slug)) notFound();
  return (
    <>
      <div className="page-head">
        <h1>{item.label}</h1>
        <span className="badge">Scheduled · Phase {item.phase}</span>
      </div>
      <div className="card" style={{ maxWidth: 680 }}>
        <p style={{ margin: 0 }}>{item.summary}</p>
        <p className="muted" style={{ margin: "12px 0 0" }}>This module is part of phase {item.phase} of the CRM build. <Link href="/crm">Back to the dashboard</Link>.</p>
      </div>
    </>
  );
}
