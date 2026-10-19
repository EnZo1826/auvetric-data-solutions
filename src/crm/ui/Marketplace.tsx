"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { crmFetch } from "./api";
import { canWrite, errText, useCrm } from "./store";
import { confirmAction, Empty, Field, Modal, PageHead } from "./ui";
import { formatDate, formatMoney, todayISO } from "@/crm/shared/calc";
import { CURRENCIES, type Currency } from "@/crm/shared/types";

type Earning = { id: string; platform: string; date: string; client_name: string; client_id: string | null; linked_client_name: string | null; contract: string; description: string;
  gross: number; fee: number; net: number; currency: Currency; fx_rate: number | null; reference: string };
const PLATFORM_LABEL: Record<string, string> = { upwork: "Upwork", fiverr: "Fiverr", freelancer: "Freelancer", other: "Other" };
const toNad = (v: number, e: Pick<Earning, "currency" | "fx_rate">) => v * (e.currency === "NAD" ? 1 : Number(e.fx_rate));

export function MarketplaceScreen() {
  const { me, toast, ensure } = useCrm();
  const [year, setYear] = useState(Number(todayISO().slice(0, 4)));
  const [rows, setRows] = useState<Earning[] | null>(null);
  const [edit, setEdit] = useState<Partial<Earning> | null>(null);
  const rw = canWrite(me?.role);
  useEffect(() => { ensure(["company", "clients"]); }, [ensure]);
  const load = useCallback(() => crmFetch<Earning[]>(`/api/crm/marketplace?from=${year}-01-01&to=${year}-12-31`).then(setRows).catch((e) => toast(errText(e), "err")), [year, toast]);
  useEffect(() => { load(); }, [load]);
  const sum = useMemo(() => {
    const by: Record<string, { gross: number; fee: number; net: number }> = {};
    for (const e of rows ?? []) {
      const s = (by[e.platform] ??= { gross: 0, fee: 0, net: 0 });
      s.gross += toNad(Number(e.gross), e); s.fee += toNad(Number(e.fee), e); s.net += toNad(Number(e.net), e);
    }
    return by;
  }, [rows]);
  const del = async (e: Earning) => {
    if (!confirmAction("Delete this earning?")) return;
    try { await crmFetch(`/api/crm/marketplace/${e.id}`, { method: "DELETE" }); load(); } catch (x) { toast(errText(x), "err"); }
  };
  const years = Array.from({ length: 5 }, (_, i) => Number(todayISO().slice(0, 4)) - i);

  return (
    <>
      <PageHead title="Marketplace earnings">{rw && <button className="primary" onClick={() => setEdit({ date: todayISO(), platform: "upwork", currency: "USD", fee: 0 })}><Plus /> Add earning</button>}</PageHead>
      <div className="filters">
        <select value={year} onChange={(e) => setYear(Number(e.target.value))} aria-label="Year">{years.map((y) => <option key={y}>{y}</option>)}</select>
        <span className="dim" style={{ fontSize: 12 }}>Platform income (Upwork, Fiverr) is paid through the platform, so it has no invoice. Record it here for complete revenue figures.</span>
      </div>
      {Object.keys(sum).length > 0 && (
        <div className="grid4" style={{ marginBottom: 12 }}>
          {Object.entries(sum).map(([p, s]) => (
            <div key={p} className="card kpi"><span className="l">{PLATFORM_LABEL[p] ?? p} · {year}</span><span className="v">{formatMoney(s.net, "NAD")}</span>
              <span className="s">gross {formatMoney(s.gross, "NAD")} · fees {formatMoney(s.fee, "NAD")} ({s.gross ? Math.round((s.fee / s.gross) * 100) : 0}%)</span></div>
          ))}
        </div>
      )}
      <div className="card flush">
        {rows === null ? <Empty>Loading…</Empty> : !rows.length ? <Empty>No platform earnings recorded for {year}.</Empty> : (
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>Date</th><th>Platform</th><th>Client / contract</th><th className="r">Gross</th><th className="r">Fee</th><th className="r">Net</th><th className="r">Net NAD</th><th /></tr></thead>
            <tbody>{rows.map((e) => (
              <tr key={e.id} className="click" onClick={() => setEdit(e)}>
                <td className="nowrap">{formatDate(e.date)}</td>
                <td>{PLATFORM_LABEL[e.platform] ?? e.platform}</td>
                <td>{e.linked_client_name ?? e.client_name ?? "—"}{e.contract && <div className="dim" style={{ fontSize: 12 }}>{e.contract}</div>}</td>
                <td className="r tabular">{formatMoney(Number(e.gross), e.currency)}</td>
                <td className="r tabular muted">{formatMoney(Number(e.fee), e.currency)}</td>
                <td className="r tabular">{formatMoney(Number(e.net), e.currency)}</td>
                <td className="r tabular">{formatMoney(toNad(Number(e.net), e), "NAD")}</td>
                <td className="r">{rw && <button className="ghost icon sm" aria-label="Delete" onClick={(ev) => { ev.stopPropagation(); del(e); }}><Trash2 /></button>}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </div>
      {edit && <EarningModal initial={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />}
    </>
  );
}

function EarningModal({ initial, onClose, onSaved }: { initial: Partial<Earning>; onClose: () => void; onSaved: () => void }) {
  const { toast, clients, company, me } = useCrm();
  const [f, setF] = useState<Partial<Earning>>({ ...initial, fx_rate: initial.fx_rate ?? (initial.currency === "NAD" ? null : Number(company?.data.usdToNad ?? 18.5)) });
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<Earning>) => setF((x) => ({ ...x, ...p }));
  const rw = canWrite(me?.role);
  const save = async () => {
    setBusy(true);
    try { await crmFetch(f.id ? `/api/crm/marketplace/${f.id}` : "/api/crm/marketplace", { method: f.id ? "PUT" : "POST", body: f }); toast("Saved"); onSaved(); }
    catch (e) { toast(errText(e), "err"); } finally { setBusy(false); }
  };
  const net = Number(f.gross ?? 0) - Number(f.fee ?? 0);
  return (
    <Modal title={f.id ? "Platform earning" : "Add platform earning"} onClose={onClose} footer={<><button onClick={onClose}>Close</button>{rw && <button className="primary" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save"}</button>}</>}>
      <div className="stack">
        <div className="grid3">
          <Field label="Platform"><select value={f.platform} onChange={(e) => set({ platform: e.target.value })}>{Object.entries(PLATFORM_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
          <Field label="Date paid out"><input type="date" value={f.date ?? ""} onChange={(e) => set({ date: e.target.value })} /></Field>
          <Field label="Reference"><input value={f.reference ?? ""} onChange={(e) => set({ reference: e.target.value })} placeholder="Transaction id" /></Field>
        </div>
        <div className="grid2">
          <Field label="Client name on the platform"><input value={f.client_name ?? ""} onChange={(e) => set({ client_name: e.target.value })} /></Field>
          <Field label="Linked CRM client (optional)"><select value={f.client_id ?? ""} onChange={(e) => set({ client_id: e.target.value || null })}><option value="">— none —</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        </div>
        <Field label="Contract / milestone"><input value={f.contract ?? ""} onChange={(e) => set({ contract: e.target.value })} /></Field>
        <div className="grid4">
          <Field label="Gross"><input type="number" step="0.01" min={0} autoFocus value={f.gross ?? ""} onChange={(e) => set({ gross: e.target.value === "" ? undefined : Number(e.target.value) })} /></Field>
          <Field label="Platform fee"><input type="number" step="0.01" min={0} value={f.fee ?? 0} onChange={(e) => set({ fee: Number(e.target.value) || 0 })} /></Field>
          <Field label="Currency"><select value={f.currency} onChange={(e) => set({ currency: e.target.value as Currency, fx_rate: e.target.value === "NAD" ? null : f.fx_rate ?? Number(company?.data.usdToNad ?? 18.5) })}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
          {f.currency !== "NAD" && <Field label="NAD per 1 USD"><input type="number" step="0.0001" min={0} value={f.fx_rate ?? ""} onChange={(e) => set({ fx_rate: Number(e.target.value) || null })} /></Field>}
        </div>
        <div className="dim" style={{ fontSize: 13 }}>Net received: <b style={{ color: "var(--text)" }}>{formatMoney(net, f.currency ?? "USD")}</b></div>
        <Field label="Notes"><textarea rows={2} value={f.description ?? ""} onChange={(e) => set({ description: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}
