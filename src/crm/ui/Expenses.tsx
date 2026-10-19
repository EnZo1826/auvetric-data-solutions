"use client";

import { AttachmentsPanel } from "./Attachments";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FileOutput, Plus, Trash2 } from "lucide-react";
import { crmFetch } from "./api";
import { canWrite, errText, useCrm } from "./store";
import { confirmAction, Empty, Field, Modal, PageHead } from "./ui";
import { InvoiceTargetPicker } from "./Time";
import { formatDate, formatMoney, todayISO } from "@/crm/shared/calc";
import { CURRENCIES, type Currency, type Project } from "@/crm/shared/types";

export const EXPENSE_CATEGORY_LABEL: Record<string, string> = { hosting: "Hosting & cloud", software: "Software & subscriptions", hardware: "Hardware & devices", travel: "Travel",
  subcontractor: "Subcontractors", fees: "Bank & platform fees", office: "Office & admin", other: "Other" };
type Expense = { id: string; date: string; supplier: string; category: string; description: string; amount: number; vat_amount: number; currency: Currency; fx_rate: number | null;
  client_id: string | null; client_name: string | null; project_id: string | null; project_title: string | null; billable: boolean; markup_pct: number; invoice_id: string | null;
  invoice_number: string | null; receipt_ref: string; paid_by_user_id: string | null; paid_by_name: string | null; notes: string };
const nad = (e: Pick<Expense, "amount" | "currency" | "fx_rate">) => Number(e.amount) * (e.currency === "NAD" ? 1 : Number(e.fx_rate));
const yearStart = () => todayISO().slice(0, 4) + "-01-01";

export function ExpensesScreen() {
  const router = useRouter();
  const { me, toast, ensure } = useCrm();
  const [from, setFrom] = useState(yearStart());
  const [to, setTo] = useState(todayISO());
  const [cat, setCat] = useState("");
  const [status, setStatus] = useState("");
  const [rows, setRows] = useState<Expense[] | null>(null);
  const [edit, setEdit] = useState<Partial<Expense> | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [rebill, setRebill] = useState(false);
  const rw = canWrite(me?.role);
  useEffect(() => { ensure(["company", "clients", "users"]); }, [ensure]);
  const load = useCallback(() => {
    const qs = new URLSearchParams({ from, to });
    if (cat) qs.set("category", cat); if (status) qs.set("status", status);
    return crmFetch<Expense[]>(`/api/crm/expenses?${qs}`).then((r) => { setRows(r); setSel(new Set()); }).catch((e) => toast(errText(e), "err"));
  }, [from, to, cat, status, toast]);
  useEffect(() => { load(); }, [load]);
  const byCat = useMemo(() => {
    const m: Record<string, number> = {};
    for (const e of rows ?? []) m[e.category] = (m[e.category] ?? 0) + nad(e);
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [rows]);
  const total = byCat.reduce((s, [, v]) => s + v, 0);
  const selRows = (rows ?? []).filter((e) => sel.has(e.id));
  const del = async (e: Expense) => {
    if (!confirmAction("Delete this expense?")) return;
    try { await crmFetch(`/api/crm/expenses/${e.id}`, { method: "DELETE" }); load(); } catch (x) { toast(errText(x), "err"); }
  };

  return (
    <>
      <PageHead title="Expenses">{rw && <button className="primary" onClick={() => setEdit({ date: todayISO(), currency: "NAD", category: "software", billable: false, markup_pct: 0, vat_amount: 0, paid_by_user_id: me?.id ?? null })}><Plus /> Add expense</button>}</PageHead>
      <div className="filters">
        <Field label="From"><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="To"><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        <select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Category"><option value="">All categories</option>{Object.entries(EXPENSE_CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Re-billing"><option value="">All expenses</option><option value="unbilled">To re-bill (not invoiced)</option></select>
      </div>
      {byCat.length > 0 && (
        <div className="card" style={{ marginBottom: 12, fontSize: 13, display: "flex", flexWrap: "wrap", gap: "6px 18px" }}>
          <span>Total <b className="tabular">{formatMoney(total, "NAD")}</b> <span className="dim">(NAD equivalent, incl. VAT)</span></span>
          {byCat.map(([k, v]) => <span key={k} className="muted">{EXPENSE_CATEGORY_LABEL[k] ?? k} <b className="tabular" style={{ color: "var(--text)" }}>{formatMoney(v, "NAD")}</b></span>)}
        </div>
      )}
      {rw && sel.size > 0 && (
        <div className="row" style={{ gap: 8, marginBottom: 10 }}>
          <span className="dim" style={{ fontSize: 12 }}>{sel.size} selected</span>
          <button className="sm primary" onClick={() => setRebill(true)}><FileOutput /> Re-bill to client</button>
          <button className="sm ghost" onClick={() => setSel(new Set())}>Clear</button>
        </div>
      )}
      <div className="card flush">
        {rows === null ? <Empty>Loading…</Empty> : !rows.length ? <Empty>No expenses in this period.</Empty> : (
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th style={{ width: 28 }}><span className="sr-only">Select</span></th><th>Date</th><th>Supplier</th><th>Category</th><th>Client / project</th><th className="r">Amount</th><th>Re-bill</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>{rows.map((e) => (
              <tr key={e.id}>
                <td>{rw && e.billable && !e.invoice_id && <input type="checkbox" checked={sel.has(e.id)} aria-label="Select for re-billing"
                  onChange={() => setSel((s) => { const n = new Set(s); if (n.has(e.id)) n.delete(e.id); else n.add(e.id); return n; })} />}</td>
                <td className="nowrap">{formatDate(e.date)}</td>
                <td className="click" onClick={() => setEdit(e)}><b style={{ fontWeight: 500 }}>{e.supplier || "—"}</b>{e.description && <div className="dim" style={{ fontSize: 12 }}>{e.description.slice(0, 120)}</div>}</td>
                <td className="muted" style={{ fontSize: 12 }}>{EXPENSE_CATEGORY_LABEL[e.category] ?? e.category}</td>
                <td style={{ fontSize: 12 }}>{e.client_name ?? <span className="dim">—</span>}{e.project_title && <div className="dim">{e.project_title}</div>}</td>
                <td className="r tabular">{formatMoney(Number(e.amount), e.currency)}{e.currency !== "NAD" && <div className="dim" style={{ fontSize: 11 }}>{formatMoney(nad(e), "NAD")}</div>}</td>
                <td>{!e.billable ? <span className="dim">—</span> : e.invoice_id ? <Link className="mono" href={`/crm/invoices/${e.invoice_id}`}>{e.invoice_number}</Link> : <span className="badge warn">to re-bill</span>}</td>
                <td className="r">{rw && !e.invoice_id && <button className="ghost icon sm" aria-label="Delete" onClick={() => del(e)}><Trash2 /></button>}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </div>
      {edit && <ExpenseModal initial={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />}
      {rebill && <RebillModal rows={selRows} onClose={() => setRebill(false)} onDone={(id) => { setRebill(false); router.push(`/crm/invoices/${id}`); }} />}
    </>
  );
}

function ExpenseModal({ initial, onClose, onSaved }: { initial: Partial<Expense>; onClose: () => void; onSaved: () => void }) {
  const { toast, clients, users, company, me } = useCrm();
  const [projects, setProjects] = useState<Project[]>([]);
  const [f, setF] = useState<Partial<Expense>>({ ...initial, fx_rate: initial.fx_rate ?? (initial.currency === "USD" ? Number(company?.data.usdToNad ?? 18.5) : null) });
  const [busy, setBusy] = useState(false);
  useEffect(() => { crmFetch<Project[]>("/api/crm/projects").then(setProjects).catch(() => {}); }, []);
  const set = (p: Partial<Expense>) => setF((x) => ({ ...x, ...p }));
  const locked = !!initial.invoice_id || !canWrite(me?.role);
  const save = async () => {
    setBusy(true);
    try { await crmFetch(f.id ? `/api/crm/expenses/${f.id}` : "/api/crm/expenses", { method: f.id ? "PUT" : "POST", body: f }); toast(f.id ? "Expense updated" : "Expense added"); onSaved(); }
    catch (e) { toast(errText(e), "err"); } finally { setBusy(false); }
  };
  return (
    <Modal title={f.id ? "Expense" : "Add expense"} onClose={onClose} footer={<><button onClick={onClose}>Close</button>{!locked && <button className="primary" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save"}</button>}</>}>
      <div className="stack">
        {initial.invoice_id && <div className="warn-box">Re-billed on {initial.invoice_number}. Remove the line from that draft invoice to edit this expense.</div>}
        <div className="grid3">
          <Field label="Date"><input type="date" disabled={locked} value={f.date ?? ""} onChange={(e) => set({ date: e.target.value })} /></Field>
          <Field label="Supplier"><input autoFocus disabled={locked} value={f.supplier ?? ""} onChange={(e) => set({ supplier: e.target.value })} placeholder="e.g. AWS, Netlify, Takealot" /></Field>
          <Field label="Category"><select disabled={locked} value={f.category} onChange={(e) => set({ category: e.target.value })}>{Object.entries(EXPENSE_CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        </div>
        <Field label="Description"><input disabled={locked} value={f.description ?? ""} onChange={(e) => set({ description: e.target.value })} /></Field>
        <div className="grid4">
          <Field label="Amount paid (incl. VAT)"><input type="number" step="0.01" min={0} disabled={locked} value={f.amount ?? ""} onChange={(e) => set({ amount: e.target.value === "" ? undefined : Number(e.target.value) })} /></Field>
          <Field label="VAT included"><input type="number" step="0.01" min={0} disabled={locked} value={f.vat_amount ?? 0} onChange={(e) => set({ vat_amount: Number(e.target.value) || 0 })} /></Field>
          <Field label="Currency"><select disabled={locked} value={f.currency} onChange={(e) => set({ currency: e.target.value as Currency, fx_rate: e.target.value === "NAD" ? null : f.fx_rate ?? Number(company?.data.usdToNad ?? 18.5) })}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
          {f.currency !== "NAD" && <Field label="NAD per 1 USD"><input type="number" step="0.0001" min={0} disabled={locked} value={f.fx_rate ?? ""} onChange={(e) => set({ fx_rate: Number(e.target.value) || null })} /></Field>}
        </div>
        <div className="grid3">
          <Field label="Client"><select disabled={locked} value={f.client_id ?? ""} onChange={(e) => set({ client_id: e.target.value || null })}><option value="">— none —</option>{clients.filter((c) => !c.archived || c.id === f.client_id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
          <Field label="Project"><select disabled={locked} value={f.project_id ?? ""} onChange={(e) => set({ project_id: e.target.value || null })}><option value="">— none —</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select></Field>
          <Field label="Paid by"><select disabled={locked} value={f.paid_by_user_id ?? ""} onChange={(e) => set({ paid_by_user_id: e.target.value || null })}><option value="">Company</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field>
        </div>
        <div className="grid3" style={{ alignItems: "end" }}>
          <label className="check"><input type="checkbox" disabled={locked} checked={!!f.billable} onChange={(e) => set({ billable: e.target.checked })} /> Re-bill to the client</label>
          {f.billable && <Field label="Handling markup %"><input type="number" step="0.5" min={0} max={500} disabled={locked} value={f.markup_pct ?? 0} onChange={(e) => set({ markup_pct: Number(e.target.value) || 0 })} /></Field>}
          <Field label="Receipt reference"><input disabled={locked} value={f.receipt_ref ?? ""} onChange={(e) => set({ receipt_ref: e.target.value })} placeholder="Invoice no. or file name" /></Field>
        </div>
        <Field label="Notes"><textarea rows={2} disabled={locked} value={f.notes ?? ""} onChange={(e) => set({ notes: e.target.value })} /></Field>
        {f.id ? <AttachmentsPanel entity="expense" entityId={f.id} title="Receipts" /> : <div className="dim" style={{ fontSize: 12 }}>Save the expense, then open it again to attach the receipt.</div>}
      </div>
    </Modal>
  );
}

function RebillModal({ rows, onClose, onDone }: { rows: Expense[]; onClose: () => void; onDone: (id: string) => void }) {
  const { toast } = useCrm();
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const clientsSel = [...new Set(rows.map((r) => r.client_id))];
  const go = async () => {
    setBusy(true);
    try { const inv = await crmFetch<{ id: string; number: string }>("/api/crm/expenses/rebill", { method: "POST", body: { ids: rows.map((r) => r.id), invoice_id: target || null } }); toast(`Added to ${inv.number}`); onDone(inv.id); }
    catch (e) { toast(errText(e), "err"); } finally { setBusy(false); }
  };
  return (
    <Modal title="Re-bill expenses" onClose={onClose} footer={<><button onClick={onClose}>Cancel</button><button className="primary" disabled={busy || clientsSel.length !== 1} onClick={go}>{busy ? "Working…" : "Create invoice lines"}</button></>}>
      {clientsSel.length !== 1 ? <div className="warn-box">Select expenses for one client at a time.</div> : (
        <div className="stack">
          <div style={{ fontSize: 13 }}>{rows.length} expense{rows.length > 1 ? "s" : ""} for <b>{rows[0].client_name}</b>. Amounts are converted to the invoice currency and include each expense&apos;s markup.</div>
          <InvoiceTargetPicker clientId={clientsSel[0]} value={target} onChange={setTarget} />
        </div>
      )}
    </Modal>
  );
}
