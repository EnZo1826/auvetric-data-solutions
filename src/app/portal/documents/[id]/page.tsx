import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download } from "lucide-react";
import { pageIp, requirePortal } from "@/crm/server/portal-page";
import { portalDocument, recordView } from "@/crm/server/portal";
import { HttpError } from "@/crm/server/http";
import { DocumentPrint, type PrintableDoc } from "@/crm/ui/DocumentPrint";
import { PayPanel, QuoteDecision } from "@/crm/ui/Portal";
import { formatDate, formatMoney, todayISO } from "@/crm/shared/calc";
import { PLACEHOLDER, type CompanyData, type DocData } from "@/crm/shared/types";

export const metadata: Metadata = { title: "Document" };
export const dynamic = "force-dynamic";

export default async function PortalDocument({ params }: { params: Promise<{ id: string }> }) {
  const s = await requirePortal();
  const { id } = await params;
  let d;
  try { d = await portalDocument(s, id); } catch (e) { if (e instanceof HttpError && e.status === 404) notFound(); throw e; }
  await recordView(s, d as never, await pageIp());
  const data = d.data as DocData & { acceptance?: { name: string; at: string }; decline?: { at: string; reason?: string } };
  const c = d.company_data as CompanyData;
  const total = Number(d.total), paid = Number(d.amount_paid ?? 0), balance = Math.max(0, Math.round((total - paid) * 100) / 100);
  const today = todayISO();
  const isQuote = d.type === "quote";
  const expired = isQuote && d.status === "sent" && String(d.due_date) < today;
  const bank = [c.bankAccountName || c.legalName, [c.bankName, c.bankBranch].filter(Boolean).join(", "), c.bankBranchCode && `Branch code: ${c.bankBranchCode}`,
    c.bankAccount && `Account: ${c.bankAccount}`, c.bankSwift && `SWIFT: ${c.bankSwift}`, c.bankExtra].filter(Boolean) as string[];
  // Never show unconfirmed placeholders as payment instructions.
  const bankReady = [c.bankName, c.bankAccount].every((v) => v && !v.includes(PLACEHOLDER));
  const bankShown = bankReady ? bank.filter((l) => !l.includes(PLACEHOLDER)) : ["Please contact us at info@auvetric.com for our banking details."];
  const when = (iso: string) => new Date(iso).toLocaleString("en-NA", { timeZone: "Africa/Windhoek", dateStyle: "medium", timeStyle: "short" });

  return (
    <div className="stack" style={{ gap: 14 }}>
      <title>{`${isQuote ? "Quotation" : "Invoice"} ${d.number} · Auvetric client portal`}</title>
      <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <Link href="/portal" className="btn ghost sm"><ArrowLeft aria-hidden /> All documents</Link>
        <h1 style={{ margin: 0, fontSize: 20 }}>{isQuote ? "Quotation" : "Invoice"} <span className="mono">{d.number}</span></h1>
        <a className="btn sm" href={`/api/portal/documents/${d.id}/pdf`} download><Download aria-hidden /> Download PDF</a>
      </div>
      {isQuote && data.acceptance && ["accepted", "invoiced"].includes(d.status) && <div className="ok-box" role="status">Accepted by {data.acceptance.name} on {when(data.acceptance.at)}. Thank you; we&apos;ll be in touch about next steps.</div>}
      {isQuote && d.status === "declined" && <div className="warn-box">You declined this quotation{data.decline?.at ? ` on ${when(data.decline.at)}` : ""}. Contact us if you&apos;d like a revised quote.</div>}
      {expired && <div className="warn-box">This quotation expired on {formatDate(String(d.due_date))}. Please contact us for an updated quote.</div>}
      {!isQuote && d.status === "paid" && <div className="ok-box" role="status">Paid in full. Thank you!</div>}
      {isQuote && d.status === "sent" && !expired && <QuoteDecision docId={String(d.id)} number={d.number} total={formatMoney(total, d.currency)} />}
      {!isQuote && d.status !== "paid" && balance > 0 && <PayPanel docId={String(d.id)} number={d.number} balance={balance} currency={d.currency} bank={bankShown} />}
      <div className="print-stage" style={{ padding: 0 }}>
        <DocumentPrint doc={{ type: d.type, number: d.number, date: String(d.date), due_date: String(d.due_date), currency: d.currency, data, status: d.status, amount_paid: paid } as PrintableDoc}
          company={{ name: d.company_name, data: c }} />
      </div>
    </div>
  );
}
