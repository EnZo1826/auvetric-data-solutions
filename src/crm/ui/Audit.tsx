"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { crmFetch } from "./api";
import { errText, useCrm } from "./store";
import { Empty, Field, PageHead } from "./ui";

type Row = { id: string; at: string; user_id: string | null; user_name: string | null; action: string; entity: string | null; entity_id: string | null; ip: string | null; detail: Record<string, unknown> };
type Facets = { actions: { prefix: string; n: number }[]; entities: { entity: string; n: number }[] };

const ACTION_LABEL: Record<string, string> = {
  auth: "Sign-in & security", invoice: "Invoices", quote: "Quotes", payment: "Payments", client: "Clients", user: "Users", retainer: "Retainers", time: "Time", expense: "Expenses",
  marketplace: "Marketplace", lead: "Leads", enquiry: "Enquiries", email: "Emails sent", mail: "Email settings", backup: "Backups", attachment: "Files", cron: "Daily job", integration: "Integrations", company: "Company profile",
};
const HREF: Record<string, (id: string) => string> = {
  client: (id) => `/crm/clients/${id}`, document: (id) => `/crm/invoices/${id}`, invoice: (id) => `/crm/invoices/${id}`, quote: (id) => `/crm/quotes/${id}`,
};
const when = (iso: string) => new Date(iso).toLocaleString("en-NA", { timeZone: "Africa/Windhoek", dateStyle: "medium", timeStyle: "medium" });
const tone = (a: string) => (/failed|locked|delete|cancel|mfa_failed/.test(a) ? "err" : /signed_in|sent|paid|restored|nightly/.test(a) ? "ok" : /reset|settings|capacity/.test(a) ? "warn" : "");

/** Admin-only: every financial create/update/delete, every sign-in, emails, backups. Newest first, 100 at a time. */
export function AuditScreen() {
  const { toast, users, ensure } = useCrm();
  const [facets, setFacets] = useState<Facets | null>(null);
  const [f, setF] = useState({ user: "", action: "", entity: "", from: "", to: "" });
  const [rows, setRows] = useState<Row[] | null>(null);
  const [more, setMore] = useState(false);
  const [open, setOpen] = useState<Set<string>>(new Set());
  useEffect(() => { ensure(["users"]); crmFetch<Facets>("/api/crm/audit/facets").then(setFacets).catch((e) => toast(errText(e), "err")); }, [ensure, toast]);
  const qs = useCallback((before?: string) => { const q = new URLSearchParams(Object.entries(f).filter(([, v]) => v)); if (before) q.set("before", before); return q.toString(); }, [f]);
  useEffect(() => {
    setRows(null);
    crmFetch<{ rows: Row[]; more: boolean }>(`/api/crm/audit?${qs()}`).then((r) => { setRows(r.rows); setMore(r.more); }).catch((e) => toast(errText(e), "err"));
  }, [qs, toast]);
  const loadMore = async () => {
    if (!rows?.length) return;
    try { const r = await crmFetch<{ rows: Row[]; more: boolean }>(`/api/crm/audit?${qs(rows[rows.length - 1].id)}`); setRows([...rows, ...r.rows]); setMore(r.more); } catch (e) { toast(errText(e), "err"); }
  };
  const toggle = (id: string) => setOpen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <>
      <PageHead title="Audit log" />
      <div className="filters" style={{ alignItems: "end" }}>
        <Field label="Who"><select value={f.user} onChange={(e) => setF({ ...f, user: e.target.value })}><option value="">Everyone</option><option value="system">System (daily job, n8n)</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field>
        <Field label="Area"><select value={f.action} onChange={(e) => setF({ ...f, action: e.target.value })}><option value="">All</option>{facets?.actions.map((a) => <option key={a.prefix} value={a.prefix + "."}>{ACTION_LABEL[a.prefix] ?? a.prefix} ({a.n})</option>)}</select></Field>
        <Field label="Record type"><select value={f.entity} onChange={(e) => setF({ ...f, entity: e.target.value })}><option value="">Any</option>{facets?.entities.map((x) => <option key={x.entity} value={x.entity}>{x.entity} ({x.n})</option>)}</select></Field>
        <Field label="From"><input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></Field>
        <Field label="To"><input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></Field>
        {Object.values(f).some(Boolean) && <button className="ghost sm" onClick={() => setF({ user: "", action: "", entity: "", from: "", to: "" })}>Clear</button>}
      </div>
      <div className="card flush">
        {rows === null ? <Empty>Loading…</Empty> : !rows.length ? <Empty>No entries match.</Empty> : (
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th style={{ width: 28 }}><span className="sr-only">Details</span></th><th>When</th><th>Who</th><th>Action</th><th>Record</th><th>IP</th></tr></thead>
            <tbody>{rows.map((r) => {
              const hasDetail = r.detail && Object.keys(r.detail).length > 0;
              const href = r.entity && r.entity_id && HREF[r.entity] ? HREF[r.entity](r.entity_id) : null;
              return (
                <Fragment key={r.id}>
                  <tr>
                    <td>{hasDetail && <button className="ghost icon sm" aria-expanded={open.has(r.id)} aria-label={open.has(r.id) ? "Hide details" : "Show details"} onClick={() => toggle(r.id)}>{open.has(r.id) ? <ChevronDown /> : <ChevronRight />}</button>}</td>
                    <td className="nowrap tabular" style={{ fontSize: 12 }}>{when(r.at)}</td>
                    <td>{r.user_name ?? <span className="dim">system</span>}</td>
                    <td><span className={"badge " + tone(r.action)}>{r.action}</span></td>
                    <td style={{ fontSize: 12 }}>{r.entity ? (href ? <Link href={href}>{r.entity} #{r.entity_id}</Link> : `${r.entity}${r.entity_id ? ` #${r.entity_id}` : ""}`) : <span className="dim">—</span>}</td>
                    <td className="mono dim" style={{ fontSize: 11 }}>{r.ip ?? ""}</td>
                  </tr>
                  {open.has(r.id) && <tr><td /><td colSpan={5}><pre className="mono" style={{ margin: 0, fontSize: 11, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{JSON.stringify(r.detail, null, 2)}</pre></td></tr>}
                </Fragment>
              );
            })}</tbody>
          </table></div>
        )}
      </div>
      {more && <div className="row" style={{ justifyContent: "center", marginTop: 10 }}><button onClick={loadMore}>Load older entries</button></div>}
      <p className="dim" style={{ fontSize: 12 }}>Entries can&apos;t be edited or deleted from the CRM. Times are Windhoek time.</p>
    </>
  );
}
