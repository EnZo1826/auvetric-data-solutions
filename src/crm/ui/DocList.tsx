"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Printer, Repeat } from "lucide-react";
import { crmFetch } from "./api";
import { canWrite, errText, useCrm } from "./store";
import { Empty, Money, PageHead, StatusBadge } from "./ui";
import { formatDate, formatMoney, todayISO, toNad } from "@/crm/shared/calc";
import { INVOICE_STATUSES, QUOTE_STATUSES, type DocListRow, type DocType } from "@/crm/shared/types";

export function DocList({ type }: { type: DocType }) {
  const router = useRouter();
  const { me, toast } = useCrm();
  const [rows, setRows] = useState<DocListRow[] | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [period, setPeriod] = useState("");
  const [sel, setSel] = useState<string[]>([]);
  const statuses: readonly string[] = type === "invoice" ? INVOICE_STATUSES : QUOTE_STATUSES;
  const base = type === "invoice" ? "/crm/invoices" : "/crm/quotes";
  const rw = canWrite(me?.role);

  const load = useCallback(() => {
    const p = new URLSearchParams({ type });
    if (status) p.set("status", status);
    if (period) p.set("period", period);
    if (q.trim()) p.set("q", q.trim());
    crmFetch<DocListRow[]>(`/api/crm/documents?${p}`).then(setRows).catch((e) => toast(errText(e), "err"));
  }, [type, status, period, q, toast]);
  useEffect(() => { const t = setTimeout(load, q ? 250 : 0); return () => clearTimeout(t); }, [load, q]);
  useEffect(() => setSel([]), [rows]);

  const today = todayISO();
  const totals = useMemo(() => {
    const by: Record<string, number> = {};
    for (const r of rows ?? []) if (r.status !== "cancelled") by[r.currency] = (by[r.currency] ?? 0) + Number(r.total);
    return by;
  }, [rows]);
  const nadTotal = useMemo(() => (rows ?? []).filter((r) => r.status !== "cancelled").reduce((s, r) => s + toNad(Number(r.total), r.currency, r.fx_rate), 0), [rows]);

  const bulk = async (s: string) => {
    try {
      const r = await crmFetch<{ results: { ok: boolean; error?: string }[] }>("/api/crm/documents/bulk-status", { method: "POST", body: { ids: sel, status: s } });
      const failed = r.results.filter((x) => !x.ok);
      toast(failed.length ? `${r.results.length - failed.length} updated, ${failed.length} skipped: ${failed[0].error}` : `${r.results.length} marked ${s}`, failed.length ? "err" : "ok");
      load();
    } catch (e) { toast(errText(e), "err"); }
  };

  const label = type === "invoice" ? "Invoices" : "Quotes";
  return (
    <>
      <PageHead title={label}>
        {type === "invoice" && <Link className="btn" href="/crm/retainers"><Repeat /> Retainers</Link>}
        {rw && <Link className="btn primary" href={`${base}/new`}><Plus /> New {type}</Link>}
      </PageHead>
      <div className="filters">
        <input type="search" placeholder={`Search number, client, reference…`} value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" />
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="">All statuses</option>
          {statuses.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
        </select>
        <input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} aria-label="Month" style={{ minWidth: 0 }} />
        {(status || period || q) && <button className="ghost sm" onClick={() => { setStatus(""); setPeriod(""); setQ(""); }}>Clear</button>}
        <div className="grow" />
        {sel.length > 0 && (
          <div className="row">
            <span className="muted" style={{ fontSize: 12 }}>{sel.length} selected</span>
            <Link className="btn sm" href={`/crm/print?ids=${sel.join(",")}`} target="_blank"><Printer /> Print</Link>
            {rw && <><button className="sm" onClick={() => bulk("sent")}>Mark sent</button>
              {type === "invoice" ? <button className="sm" onClick={() => bulk("paid")}>Mark paid</button> : <button className="sm" onClick={() => bulk("accepted")}>Mark accepted</button>}</>}
          </div>
        )}
      </div>
      <div className="card flush">
        {rows === null ? <Empty>Loading…</Empty> : !rows.length ? <Empty>No {label.toLowerCase()} match.{rw && <> <Link href={`${base}/new`}>Create one</Link>.</>}</Empty> : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th className="chk"><input type="checkbox" aria-label="Select all" checked={sel.length === rows.length} onChange={(e) => setSel(e.target.checked ? rows.map((r) => r.id) : [])} /></th>
                  <th>Number</th><th>Client</th><th>Reference</th><th>Date</th><th>{type === "invoice" ? "Due" : "Valid until"}</th><th>Status</th><th className="r">Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const late = type === "invoice" && r.status === "sent" && r.due_date < today;
                  return (
                    <tr key={r.id} className="click" onClick={() => router.push(`${base}/${r.id}`)}>
                      <td className="chk" onClick={(e) => e.stopPropagation()}><input type="checkbox" aria-label={`Select ${r.number}`} checked={sel.includes(r.id)} onChange={(e) => setSel((s) => (e.target.checked ? [...s, r.id] : s.filter((x) => x !== r.id)))} /></td>
                      <td className="mono nowrap">{r.number}{r.retainer_id && <span className="badge" style={{ marginLeft: 6 }} title="Retainer invoice">R</span>}</td>
                      <td>{r.client_name}</td>
                      <td className="muted" style={{ maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.remarks}</td>
                      <td className="nowrap">{formatDate(r.date)}</td>
                      <td className="nowrap" style={late ? { color: "var(--err)" } : undefined}>{formatDate(r.due_date)}</td>
                      <td><StatusBadge s={late ? "overdue" : r.status} /></td>
                      <td className="r"><Money v={Number(r.total)} c={r.currency} /></td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={7} className="muted" style={{ fontWeight: 500 }}>{rows.length} {label.toLowerCase()} (excl. cancelled){Object.keys(totals).length > 1 && <> · ≈ {formatMoney(nadTotal, "NAD")} in NAD</>}</td>
                  <td className="r">{Object.entries(totals).map(([c, v]) => <div key={c}><Money v={v} c={c} /></div>)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
