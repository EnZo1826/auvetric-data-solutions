import type { Metadata } from "next";
import Link from "next/link";
import { Download, FileText } from "lucide-react";
import { requirePortal } from "@/crm/server/portal-page";
import { portalDocuments } from "@/crm/server/portal";
import { PortalSignOut } from "@/crm/ui/Portal";
import { formatDate, formatMoney, todayISO } from "@/crm/shared/calc";

export const metadata: Metadata = { title: "Your documents" };
export const dynamic = "force-dynamic";

type Row = { id: string; type: "invoice" | "quote"; number: string; status: string; date: string; due_date: string; currency: string; total: number; amount_paid: number; client_id: string; remarks: string | null };

function invoiceState(d: Row, today: string) {
  if (d.status === "paid") return { label: "Paid", tone: "ok" };
  if (d.status === "overdue" || d.due_date < today) return { label: "Overdue", tone: "err" };
  return { label: Number(d.amount_paid) > 0 ? "Part paid" : "Open", tone: "info" };
}
function quoteState(d: Row, today: string) {
  if (d.status === "accepted" || d.status === "invoiced") return { label: "Accepted", tone: "ok" };
  if (d.status === "declined") return { label: "Declined", tone: "" };
  return d.due_date < today ? { label: "Expired", tone: "" } : { label: "Awaiting your response", tone: "warn" };
}

export default async function PortalHome() {
  const s = await requirePortal();
  const docs = (await portalDocuments(s)) as unknown as Row[];
  const today = todayISO();
  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div><h1 style={{ margin: 0, fontSize: 24 }}>Your documents</h1><div className="dim" style={{ fontSize: 13 }}>Signed in as {s.email}</div></div>
        <PortalSignOut />
      </div>
      {s.clients.map((c) => {
        const mine = docs.filter((d) => String(d.client_id) === c.id);
        const inv = mine.filter((d) => d.type === "invoice");
        const quotes = mine.filter((d) => d.type === "quote");
        const due: Record<string, number> = {};
        for (const d of inv) if (d.status !== "paid") due[d.currency] = (due[d.currency] ?? 0) + Number(d.total) - Number(d.amount_paid);
        const waiting = quotes.filter((q) => q.status === "sent" && q.due_date >= today);
        return (
          <section key={c.id} className="stack" aria-labelledby={`c-${c.id}`}>
            {s.clients.length > 1 && <h2 id={`c-${c.id}`} style={{ margin: 0 }}>{c.name}</h2>}
            {s.clients.length === 1 && <h2 id={`c-${c.id}`} className="sr-only">{c.name}</h2>}
            <div className="grid3">
              <div className="card kpi"><span className="l">Balance due</span><span className="v">{Object.keys(due).length ? Object.entries(due).map(([cur, v]) => formatMoney(v, cur)).join(" + ") : formatMoney(0, c.currency)}</span>
                <span className="s">{inv.filter((d) => d.status !== "paid").length} open invoice(s)</span></div>
              <div className="card kpi"><span className="l">Quotes awaiting you</span><span className="v">{waiting.length}</span><span className="s">accept or decline online</span></div>
              <div className="card kpi"><span className="l">Statement</span><span className="v" style={{ fontSize: 16 }}><a href={`/api/portal/statement/pdf?client_id=${c.id}`} download style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Download aria-hidden style={{ width: 16, height: 16 }} /> Download PDF</a></span><span className="s">this year to date</span></div>
            </div>
            {waiting.length > 0 && (
              <div className="card stack" style={{ borderColor: "var(--warn)" }}>
                <h3 style={{ margin: 0, fontSize: 15 }}>Awaiting your response</h3>
                {waiting.map((q) => <div key={q.id} className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}><Link href={`/portal/documents/${q.id}`} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><FileText aria-hidden style={{ width: 15, height: 15, flex: "none" }} /> Quotation {q.number}{q.remarks ? ` · ${q.remarks}` : ""}</Link><span className="tabular">{formatMoney(Number(q.total), q.currency)} · valid until {formatDate(q.due_date)}</span></div>)}
              </div>
            )}
            <div className="card flush">
              <h3 style={{ margin: 0, padding: "12px 14px 4px", fontSize: 15 }}>Invoices</h3>
              {!inv.length ? <div className="empty">No invoices yet.</div> : (
                <div className="tbl-wrap"><table className="tbl">
                  <thead><tr><th>Invoice</th><th>Date</th><th>Due</th><th className="r">Total</th><th className="r">Balance</th><th>Status</th></tr></thead>
                  <tbody>{inv.map((d) => { const st = invoiceState(d, today); return (
                    <tr key={d.id}><td><Link className="mono nowrap" href={`/portal/documents/${d.id}`}>{d.number}</Link>{d.remarks && <div className="dim" style={{ fontSize: 12 }}>{d.remarks}</div>}</td>
                      <td className="nowrap">{formatDate(d.date)}</td><td className="nowrap">{formatDate(d.due_date)}</td>
                      <td className="r tabular">{formatMoney(Number(d.total), d.currency)}</td>
                      <td className="r tabular">{d.status === "paid" ? "—" : formatMoney(Number(d.total) - Number(d.amount_paid), d.currency)}</td>
                      <td><span className={"badge " + st.tone}>{st.label}</span></td></tr>); })}</tbody>
                </table></div>
              )}
            </div>
            <div className="card flush">
              <h3 style={{ margin: 0, padding: "12px 14px 4px", fontSize: 15 }}>Quotations</h3>
              {!quotes.length ? <div className="empty">No quotations yet.</div> : (
                <div className="tbl-wrap"><table className="tbl">
                  <thead><tr><th>Quotation</th><th>Date</th><th>Valid until</th><th className="r">Total</th><th>Status</th></tr></thead>
                  <tbody>{quotes.map((d) => { const st = quoteState(d, today); return (
                    <tr key={d.id}><td><Link className="mono nowrap" href={`/portal/documents/${d.id}`}>{d.number}</Link>{d.remarks && <div className="dim" style={{ fontSize: 12 }}>{d.remarks}</div>}</td>
                      <td className="nowrap">{formatDate(d.date)}</td><td className="nowrap">{formatDate(d.due_date)}</td>
                      <td className="r tabular">{formatMoney(Number(d.total), d.currency)}</td><td><span className={"badge " + st.tone}>{st.label}</span></td></tr>); })}</tbody>
                </table></div>
              )}
            </div>
          </section>
        );
      })}
      <p className="dim" style={{ fontSize: 12, margin: 0 }}>Questions about a document? Reply to the email it came with, or write to info@auvetric.com.</p>
    </div>
  );
}
