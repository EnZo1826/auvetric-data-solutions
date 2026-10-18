import type { Metadata } from "next";
import Link from "next/link";
import { requireSession } from "@/crm/server/page-auth";
import { db } from "@/crm/server/db";
import { DocumentPrint, type PrintableDoc } from "@/crm/ui/DocumentPrint";
import { PrintButton } from "@/crm/ui/PrintButton";
import type { CompanyData } from "@/crm/shared/types";

export const metadata: Metadata = { title: "Print" };
export const dynamic = "force-dynamic";

/** /crm/print?ids=1,2,3 — one A4 page per document; the browser's Print → Save as PDF produces the files. */
export default async function PrintPage({ searchParams }: { searchParams: Promise<{ ids?: string }> }) {
  await requireSession();
  const { ids = "" } = await searchParams;
  const list = ids.split(",").filter((x) => /^\d{1,18}$/.test(x)).slice(0, 100);
  const docs = list.length ? await db()`select d.*, c.name as company_name, c.data as company_data from documents d join companies c on c.id = d.company_id where d.id in ${db()(list)}` : [];
  const ordered = list.map((i) => docs.find((d) => String(d.id) === i)).filter(Boolean) as typeof docs;
  const title = ordered.length === 1 ? `${ordered[0].number} ${ordered[0].data.client.name}` : `${ordered.length} documents`;
  return (
    <>
      <title>{title}</title>
      <div className="print-bar">
        <Link href={ordered.length === 1 ? `/crm/${ordered[0].type}s/${ordered[0].id}` : "/crm/invoices"} className="btn ghost sm">← Back</Link>
        <span className="muted" style={{ fontSize: 13 }}>{ordered.length ? `${ordered.length} document${ordered.length > 1 ? "s" : ""}. Use Print → “Save as PDF”, A4, margins none.` : "Nothing to print."}</span>
        <div className="grow" />
        {ordered.length > 0 && <PrintButton />}
      </div>
      <div className="print-stage">
        {ordered.map((d) => (
          <DocumentPrint key={d.id} doc={d as unknown as PrintableDoc} company={{ name: d.company_name, data: d.company_data as CompanyData }} />
        ))}
      </div>
    </>
  );
}
