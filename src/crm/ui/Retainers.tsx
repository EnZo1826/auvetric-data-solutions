"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Play, Plus } from "lucide-react";
import { crmFetch } from "./api";
import { canWrite, errText, useCrm } from "./store";
import { confirmAction, Empty, Field, Modal, Money, PageHead, StatusBadge } from "./ui";
import { LineEditor } from "./LineEditor";
import { computeTotals, todayISO } from "@/crm/shared/calc";
import { CURRENCIES, RETAINER_KINDS, RETAINER_LABEL, type Currency, type Retainer, type RetainerKind } from "@/crm/shared/types";

type StatusRow = { id: string; document_id: string | null; number: string | null; status: string | null; total: number | null; currency: Currency | null };
type GenResult = { created: { number: string; client: string }[]; skipped: { client: string; reason: string }[] };

export function RetainersScreen() {
  const { clients, me, ensure, toast } = useCrm();
  const [rows, setRows] = useState<Retainer[] | null>(null);
  const [status, setStatus] = useState<StatusRow[]>([]);
  const [period, setPeriod] = useState(todayISO().slice(0, 7));
  const [edit, setEdit] = useState<Partial<Retainer> | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<GenResult | null>(null);
  const rw = canWrite(me?.role);

  useEffect(() => { ensure(["clients", "services", "company"]); }, [ensure]);
  const load = useCallback(async () => {
    try {
      const [r, s] = await Promise.all([crmFetch<Retainer[]>("/api/crm/retainers"), crmFetch<StatusRow[]>(`/api/crm/retainers/status?period=${period}`)]);
      setRows(r); setStatus(s);
    } catch (e) { toast(errText(e), "err"); }
  }, [period, toast]);
  useEffect(() => { load(); }, [load]);

  const st = useMemo(() => new Map(status.map((s) => [s.id, s])), [status]);
  const active = (rows ?? []).filter((r) => r.active);
  const pending = active.filter((r) => !st.get(r.id)?.document_id);
  const monthly = useMemo(() => {
    const by: Record<string, number> = {};
    for (const r of active) by[r.currency] = (by[r.currency] ?? 0) + computeTotals(r.data.lines, 0, r.data.discount).total;
    return by;
  }, [active]);

  const generate = async (ids?: string[]) => {
    if (!ids && !confirmAction(`Create draft invoices for ${pending.length} retainer(s) for ${period}?`)) return;
    setBusy(true);
    try {
      const r = await crmFetch<GenResult>("/api/crm/retainers/generate", { method: "POST", body: { period, ids } });
      setResult(r);
      toast(`${r.created.length} invoice(s) created${r.skipped.length ? `, ${r.skipped.length} skipped` : ""}`);
      load();
    } catch (e) { toast(errText(e), "err"); } finally { setBusy(false); }
  };

  return (
    <>
      <PageHead title="Retainers">
        <input type="month" value={period} onChange={(e) => e.target.value && setPeriod(e.target.value)} aria-label="Billing month" style={{ width: "auto" }} />
        {rw && <button disabled={busy || !pending.length} onClick={() => generate()}><Play /> Generate {pending.length || ""} pending</button>}
        {rw && <button className="primary" onClick={() => setEdit({ kind: "support", currency: "NAD", active: true, auto: false, day_of_month: 1, data: { lines: [], remarks: "", discount: 0 } })}><Plus /> New retainer</button>}
      </PageHead>
      <div className="grid3" style={{ marginBottom: 12 }}>
        <div className="card kpi"><span className="l">Active retainers</span><span className="v">{active.length}</span><span className="s">{active.filter((r) => r.auto).length} on auto</span></div>
        <div className="card kpi"><span className="l">Monthly value (excl. VAT)</span><span className="v" style={{ fontSize: 18 }}>{Object.entries(monthly).map(([c, v]) => <div key={c}><Money v={v} c={c} /></div>)}{!active.length && "—"}</span></div>
        <div className="card kpi"><span className="l">{period} invoiced</span><span className="v">{active.length - pending.length} / {active.length}</span><span className="s">{pending.length ? `${pending.length} still to invoice` : "all done"}</span></div>
      </div>
      {result && (result.created.length > 0 || result.skipped.length > 0) && (
        <div className={result.skipped.length ? "warn-box" : "ok-box"} style={{ marginBottom: 12 }}>
          {result.created.length > 0 && <div>Created: {result.created.map((c) => `${c.number} (${c.client})`).join(", ")}. They&apos;re drafts: review and mark sent from <Link href="/crm/invoices">Invoices</Link>.</div>}
          {result.skipped.map((s, i) => <div key={i}>Skipped {s.client}: {s.reason}</div>)}
        </div>
      )}
      <div className="card flush">
        {rows === null ? <Empty>Loading…</Empty> : !rows.length ? <Empty>No retainers yet. Create one, or open an invoice and choose “Make monthly retainer”.</Empty> : (
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>Retainer</th><th>Client</th><th>Type</th><th>Bills on</th><th className="r">Monthly</th><th>{period}</th><th></th></tr></thead>
            <tbody>
              {rows.map((r) => {
                const s = st.get(r.id);
                return (
                  <tr key={r.id} style={r.active ? undefined : { opacity: 0.55 }}>
                    <td><b>{r.name}</b>{r.auto && <span className="badge info" style={{ marginLeft: 6 }}>auto</span>}{!r.active && <span className="badge" style={{ marginLeft: 6 }}>paused</span>}</td>
                    <td>{r.client_name}</td>
                    <td>{RETAINER_LABEL[r.kind]}</td>
                    <td>Day {r.day_of_month}</td>
                    <td className="r"><Money v={computeTotals(r.data.lines, 0, r.data.discount).total} c={r.currency} /></td>
                    <td>{s?.document_id ? <Link href={`/crm/invoices/${s.document_id}`} className="mono">{s.number}</Link> : r.active ? <span className="dim">not yet</span> : "—"} {s?.status && <StatusBadge s={s.status} />}</td>
                    <td className="r nowrap">
                      {rw && r.active && !s?.document_id && <button className="sm" disabled={busy} onClick={() => generate([r.id])}>Invoice now</button>}
                      {rw && <button className="ghost icon sm" aria-label="Edit" onClick={() => setEdit(r)}><Pencil /></button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        )}
      </div>
      <p className="dim" style={{ fontSize: 12, marginTop: 10 }}>Retainers marked <b>auto</b> are invoiced as drafts by the daily job (06:00 Windhoek) once their billing day arrives. The same job marks sent invoices past their due date as overdue. A retainer is never invoiced twice for the same month.</p>
      {edit && <RetainerModal initial={edit} clients={clients} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />}
    </>
  );
}

function RetainerModal({ initial, clients, onClose, onSaved }: { initial: Partial<Retainer>; clients: ReturnType<typeof useCrm.getState>["clients"]; onClose: () => void; onSaved: () => void }) {
  const { toast } = useCrm();
  const [f, setF] = useState<Partial<Retainer>>(initial);
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<Retainer>) => setF((x) => ({ ...x, ...p }));
  const data = f.data!;
  const save = async () => {
    setBusy(true);
    try {
      await crmFetch(f.id ? `/api/crm/retainers/${f.id}` : "/api/crm/retainers", { method: f.id ? "PUT" : "POST", body: f });
      toast("Retainer saved"); onSaved();
    } catch (e) { toast(errText(e), "err"); } finally { setBusy(false); }
  };
  const remove = async () => {
    if (!f.id || !confirmAction("Delete this retainer? If it has invoices it's paused instead.")) return;
    try { const r = await crmFetch<{ deactivated: boolean }>(`/api/crm/retainers/${f.id}`, { method: "DELETE" }); toast(r.deactivated ? "Retainer paused (it has invoices)" : "Retainer deleted"); onSaved(); } catch (e) { toast(errText(e), "err"); }
  };
  return (
    <Modal wide title={f.id ? "Edit retainer" : "New retainer"} onClose={onClose} footer={<>
      {f.id && <button className="danger" onClick={remove}>Delete</button>}<div className="grow" />
      <button onClick={onClose}>Cancel</button>
      <button className="primary" disabled={busy || !f.client_id} onClick={save}>{busy ? "Saving…" : "Save"}</button>
    </>}>
      <div className="stack">
        <div className="grid4">
          <Field label="Client"><select value={f.client_id ?? ""} onChange={(e) => { const c = clients.find((x) => x.id === e.target.value); set({ client_id: e.target.value, ...(c && !f.id ? { currency: c.currency } : {}) }); }}><option value="">Choose…</option>{clients.filter((c) => !c.archived).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
          <Field label="Name"><input value={f.name ?? ""} placeholder="e.g. Fleet platform support" onChange={(e) => set({ name: e.target.value })} /></Field>
          <Field label="Type"><select value={f.kind} onChange={(e) => set({ kind: e.target.value as RetainerKind })}>{RETAINER_KINDS.map((k) => <option key={k} value={k}>{RETAINER_LABEL[k]}</option>)}</select></Field>
          <Field label="Currency"><select value={f.currency} onChange={(e) => set({ currency: e.target.value as Currency })}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
          <Field label="Billing day (1–28)"><input type="number" min={1} max={28} value={f.day_of_month ?? 1} onChange={(e) => set({ day_of_month: Math.min(28, Math.max(1, Number(e.target.value) || 1)) })} /></Field>
          <Field label="Discount"><input type="number" step="any" min={0} value={data.discount} onChange={(e) => set({ data: { ...data, discount: Number(e.target.value) || 0 } })} /></Field>
        </div>
        <Field label="Invoice reference (printed)"><input value={data.remarks} placeholder="e.g. Monthly support retainer" onChange={(e) => set({ data: { ...data, remarks: e.target.value } })} /></Field>
        <LineEditor lines={data.lines} currency={f.currency ?? "NAD"} onChange={(lines) => set({ data: { ...data, lines } })} />
        <div className="row">
          <label className="check"><input type="checkbox" checked={f.active !== false} onChange={(e) => set({ active: e.target.checked })} /> Active</label>
          <label className="check"><input type="checkbox" checked={!!f.auto} onChange={(e) => set({ auto: e.target.checked })} /> Auto-generate a draft invoice on the billing day</label>
        </div>
      </div>
    </Modal>
  );
}
