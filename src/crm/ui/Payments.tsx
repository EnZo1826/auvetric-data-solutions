"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { crmFetch } from "./api";
import { canWrite, errText, useCrm } from "./store";
import { confirmAction, Empty, Field, Modal, Money, PageHead, Tabs } from "./ui";
import { formatDate, formatMoney, todayISO } from "@/crm/shared/calc";
import type { Currency } from "@/crm/shared/types";

const SHORT_METHOD: Record<string, string> = { eft: "EFT", cash: "cash", card: "card", upwork: "Upwork", paypal: "PayPal", wise: "Wise", other: "other" };
export const METHOD_LABEL: Record<string, string> = { eft: "EFT / bank transfer", cash: "Cash", card: "Card", upwork: "Upwork", paypal: "PayPal", wise: "Wise", other: "Other" };
type Payment = { id: string; document_id: string; date: string; amount: number; method: string; reference: string; notes: string; auto: boolean; created_by_name?: string | null; number?: string; currency?: Currency; client_id?: string | null; client_name?: string };

export function RecordPaymentModal({ invoice, onClose, onSaved }: { invoice: { id: string; number: string; currency: Currency; balance: number }; onClose: () => void; onSaved: () => void }) {
  const { toast } = useCrm();
  const [f, setF] = useState({ date: todayISO(), amount: String(invoice.balance.toFixed(2)), method: "eft", reference: "", notes: "" });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      const r = await crmFetch<{ invoice?: { status: string } }>("/api/crm/payments", { method: "POST", body: { ...f, amount: Number(f.amount), document_id: invoice.id } });
      toast(r.invoice?.status === "paid" ? `${invoice.number} is paid in full` : "Payment recorded");
      onSaved();
    } catch (e) { toast(errText(e), "err"); } finally { setBusy(false); }
  };
  return (
    <Modal title={`Record payment · ${invoice.number}`} onClose={onClose} footer={<><button onClick={onClose}>Cancel</button><button className="primary" disabled={busy || !(Number(f.amount) > 0)} onClick={save}>{busy ? "Saving…" : "Record payment"}</button></>}>
      <div className="stack">
        <div className="dim" style={{ fontSize: 13 }}>Balance due: <b style={{ color: "var(--text)" }}>{formatMoney(invoice.balance, invoice.currency)}</b></div>
        <div className="grid3">
          <Field label="Date received"><input type="date" max={todayISO()} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
          <Field label={`Amount (${invoice.currency})`}><input type="number" step="0.01" min={0} autoFocus value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
          <Field label="Method"><select value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}>{Object.entries(METHOD_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        </div>
        <Field label="Reference" hint="Bank reference or transaction id"><input value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} /></Field>
        <Field label="Notes"><textarea rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}

/** Payments panel on an invoice. */
export function PaymentsPanel({ invoice, onChange }: { invoice: { id: string; number: string; status: string; currency: Currency; total: number }; onChange: () => void }) {
  const { me, toast } = useCrm();
  const [rows, setRows] = useState<Payment[] | null>(null);
  const [adding, setAdding] = useState(false);
  const load = useCallback(() => crmFetch<Payment[]>(`/api/crm/documents/${invoice.id}/payments`).then(setRows).catch((e) => toast(errText(e), "err")), [invoice.id, toast]);
  useEffect(() => { load(); }, [load, invoice.status]);
  const paid = (rows ?? []).reduce((s, p) => s + Number(p.amount), 0);
  const balance = Math.round((Number(invoice.total) - paid) * 100) / 100;
  const del = async (p: Payment) => {
    if (!confirmAction(`Remove the ${formatMoney(Number(p.amount), invoice.currency)} payment of ${formatDate(p.date)}?`)) return;
    try { await crmFetch(`/api/crm/payments/${p.id}`, { method: "DELETE" }); toast("Payment removed"); load(); onChange(); } catch (e) { toast(errText(e), "err"); }
  };
  const canPay = canWrite(me?.role) && ["sent", "overdue"].includes(invoice.status) && balance > 0;
  return (
    <section className="card stack" style={{ gap: 8 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2 style={{ margin: 0 }}>Payments</h2>
        {canPay && <button className="sm primary" onClick={() => setAdding(true)}><Plus /> Record payment</button>}
      </div>
      {!rows ? <div className="dim" style={{ fontSize: 13 }}>Loading…</div> : !rows.length ? <div className="dim" style={{ fontSize: 13 }}>{invoice.status === "draft" ? "Mark the invoice sent to record payments." : "No payments yet."}</div> : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6, fontSize: 13 }}>{rows.map((p) => (
          <li key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid var(--line)", paddingBottom: 6 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div>{formatDate(p.date)} <span className="dim">· {p.auto ? "marked paid" : SHORT_METHOD[p.method] ?? p.method}</span></div>
              {p.reference && !p.auto && <div className="dim" style={{ fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={p.reference}>{p.reference}</div>}
            </div>
            <Money v={Number(p.amount)} c={invoice.currency} />
            {canWrite(me?.role) && !p.auto && <button className="ghost icon sm" aria-label="Remove payment" onClick={() => del(p)}><Trash2 /></button>}
          </li>
        ))}</ul>
      )}
      <dl className="kv" style={{ gridTemplateColumns: "1fr auto" }}>
        <dt>Paid</dt><dd className="r"><Money v={paid} c={invoice.currency} /></dd>
        <dt><b>Balance due</b></dt><dd className="r"><b><Money v={invoice.status === "cancelled" ? 0 : Math.max(0, balance)} c={invoice.currency} /></b></dd>
      </dl>
      {adding && <RecordPaymentModal invoice={{ id: invoice.id, number: invoice.number, currency: invoice.currency, balance }} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); load(); onChange(); }} />}
    </section>
  );
}

type AgeRow = { client_id: string | null; client_name: string; currency: Currency; current: number; d30: number; d60: number; d90: number; d90plus: number; total: number; total_nad: number;
  invoices: { id: string; number: string; date: string; due_date: string; total: number; balance: number; days_overdue: number }[] };
const firstOfMonth = () => todayISO().slice(0, 8) + "01";

export function PaymentsScreen() {
  const [tab, setTab] = useState<"payments" | "ageing">("payments");
  return (
    <>
      <PageHead title="Payments" />
      <div className="filters"><Tabs value={tab} onChange={setTab} tabs={[{ key: "payments", label: "Payments received" }, { key: "ageing", label: "Debtors ageing" }]} /></div>
      {tab === "payments" ? <PaymentList /> : <Ageing />}
    </>
  );
}

function PaymentList() {
  const { toast } = useCrm();
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(todayISO());
  const [rows, setRows] = useState<Payment[] | null>(null);
  useEffect(() => { crmFetch<Payment[]>(`/api/crm/payments?from=${from}&to=${to}`).then(setRows).catch((e) => toast(errText(e), "err")); }, [from, to, toast]);
  const totals = (rows ?? []).reduce<Record<string, number>>((a, p) => ({ ...a, [p.currency!]: (a[p.currency!] ?? 0) + Number(p.amount) }), {});
  return (
    <>
      <div className="filters">
        <Field label="From"><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="To"><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        <span className="dim" style={{ fontSize: 12, marginLeft: "auto" }}>Received: {Object.entries(totals).map(([c, v]) => <b key={c} style={{ color: "var(--text)", marginLeft: 8 }}>{formatMoney(v, c)}</b>)}{!Object.keys(totals).length && "—"}</span>
      </div>
      <div className="card flush">
        {rows === null ? <Empty>Loading…</Empty> : !rows.length ? <Empty>No payments in this period. Record payments from the invoice.</Empty> : (
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>Date</th><th>Invoice</th><th>Client</th><th>Method</th><th>Reference</th><th className="r">Amount</th></tr></thead>
            <tbody>{rows.map((p) => (
              <tr key={p.id}>
                <td className="nowrap">{formatDate(p.date)}</td>
                <td className="mono"><Link href={`/crm/invoices/${p.document_id}`}>{p.number}</Link></td>
                <td>{p.client_id ? <Link href={`/crm/clients/${p.client_id}`}>{p.client_name}</Link> : p.client_name}</td>
                <td className="muted">{p.auto ? "Marked paid" : METHOD_LABEL[p.method] ?? p.method}</td>
                <td className="muted" style={{ fontSize: 12 }}>{p.reference || "—"}</td>
                <td className="r"><Money v={Number(p.amount)} c={p.currency!} /></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </div>
    </>
  );
}

function Ageing() {
  const { toast } = useCrm();
  const [d, setD] = useState<{ as_of: string; clients: AgeRow[] } | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => { crmFetch<{ as_of: string; clients: AgeRow[] }>("/api/crm/debtors").then(setD).catch((e) => toast(errText(e), "err")); }, [toast]);
  if (!d) return <Empty>Loading…</Empty>;
  const cols = [["current", "Not yet due"], ["d30", "1–30 days"], ["d60", "31–60"], ["d90", "61–90"], ["d90plus", "90+"]] as const;
  const totalNad = d.clients.reduce((s, c) => s + c.total_nad, 0);
  return (
    <div className="card flush">
      <div className="row" style={{ padding: "12px 16px", justifyContent: "space-between" }}>
        <span className="dim" style={{ fontSize: 12 }}>Open invoice balances as at {formatDate(d.as_of)}, by days past due. Click a client to see the invoices.</span>
        <span style={{ fontSize: 13 }}>Total owed <b className="tabular">{formatMoney(totalNad, "NAD")}</b> <span className="dim">(NAD equivalent)</span></span>
      </div>
      {!d.clients.length ? <Empty>Nobody owes you anything right now.</Empty> : (
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>Client</th><th>Cur.</th>{cols.map(([k, l]) => <th key={k} className="r">{l}</th>)}<th className="r">Total</th><th /></tr></thead>
          <tbody>{d.clients.map((c) => {
            const key = `${c.client_id}|${c.currency}`;
            return [
              <tr key={key} className="click" onClick={() => setOpen(open === key ? null : key)}>
                <td><b>{c.client_name}</b></td><td className="muted">{c.currency}</td>
                {cols.map(([k]) => <td key={k} className="r tabular" style={k !== "current" && c[k] > 0 ? { color: k === "d30" ? "var(--warn)" : "var(--err)" } : undefined}>{c[k] ? formatMoney(c[k], c.currency) : <span className="dim">—</span>}</td>)}
                <td className="r tabular"><b>{formatMoney(c.total, c.currency)}</b></td>
                <td className="r">{c.client_id && <Link className="btn sm" href={`/crm/print/statement?client_id=${c.client_id}`} onClick={(e) => e.stopPropagation()}>Statement</Link>}</td>
              </tr>,
              open === key && c.invoices.map((i) => (
                <tr key={key + i.id} style={{ fontSize: 12 }}>
                  <td colSpan={2} className="mono" style={{ paddingLeft: 28 }}><Link href={`/crm/invoices/${i.id}`}>{i.number}</Link></td>
                  <td colSpan={3} className="muted">Dated {formatDate(i.date)} · due {formatDate(i.due_date)}{i.days_overdue > 0 ? ` · ${i.days_overdue} days late` : ""}</td>
                  <td colSpan={2} className="r muted">of {formatMoney(i.total, c.currency)}</td>
                  <td className="r tabular">{formatMoney(i.balance, c.currency)}</td><td />
                </tr>
              )),
            ];
          })}</tbody>
        </table></div>
      )}
    </div>
  );
}
