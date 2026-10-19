"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Check, ExternalLink, Send, X } from "lucide-react";
import { crmFetch } from "./api";
import { canWrite, errText, useCrm } from "./store";
import { confirmAction } from "./ui";
import { RecordPaymentModal } from "./Payments";
import { formatDate, formatMoney } from "@/crm/shared/calc";
import type { Currency } from "@/crm/shared/types";

type PortalInfo = { enabled: boolean; people: { email: string; label: string }[]; active_sessions: number;
  events: { id: string; at: string; email: string; kind: string; number: string | null; type: string | null; document_id: string | null; detail: Record<string, unknown> }[] };
const KIND: Record<string, string> = { invite: "invited", signin: "signed in", view: "viewed", accept: "accepted", decline: "declined", proof: "reported a payment for" };
const when = (iso: string) => new Date(iso).toLocaleString("en-NA", { timeZone: "Africa/Windhoek", dateStyle: "medium", timeStyle: "short" });

/** Client detail → portal access, invitations and recent portal activity. */
export function PortalCard({ clientId }: { clientId: string }) {
  const { me, toast } = useCrm();
  const [d, setD] = useState<PortalInfo | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const rw = canWrite(me?.role);
  const load = useCallback(() => crmFetch<PortalInfo>(`/api/crm/clients/${clientId}/portal`).then(setD).catch((e) => toast(errText(e), "err")), [clientId, toast]);
  useEffect(() => { load(); }, [load]);
  if (!d) return null;
  const toggle = async () => {
    if (d.enabled && !confirmAction("Switch the portal off? Anyone signed in loses access immediately.")) return;
    setBusy("toggle");
    try { await crmFetch(`/api/crm/clients/${clientId}/portal`, { method: "PATCH", body: { enabled: !d.enabled } }); toast(d.enabled ? "Portal switched off" : "Portal switched on"); load(); }
    catch (e) { toast(errText(e), "err"); } finally { setBusy(null); }
  };
  const invite = async (email: string) => {
    setBusy(email);
    try { await crmFetch(`/api/crm/clients/${clientId}/portal/invite`, { method: "POST", body: { email } }); toast(`Invitation sent to ${email}`); load(); }
    catch (e) { toast(errText(e), "err"); } finally { setBusy(null); }
  };
  return (
    <section className="card stack" aria-label="Client portal">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2 style={{ margin: 0 }}>Client portal</h2>
        <span className={"badge " + (d.enabled ? "ok" : "")}>{d.enabled ? "on" : "off"}</span>
      </div>
      <p className="muted" style={{ margin: 0, fontSize: 12 }}>
        Lets the client&apos;s people sign in at <span className="mono">/portal</span> with an emailed one-time link to view sent quotes and invoices, accept quotes and report payments.
        {d.enabled && d.active_sessions > 0 && <> {d.active_sessions} signed in now.</>}
      </p>
      {rw && <button className={d.enabled ? "sm" : "sm primary"} disabled={busy !== null} onClick={toggle}>{d.enabled ? "Switch off" : "Switch on"}</button>}
      {d.enabled && (
        <div className="stack" style={{ gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 500 }}>Can sign in</span>
          {!d.people.length ? <div className="dim" style={{ fontSize: 12 }}>Add an email address to the client or a contact first.</div>
            : d.people.map((p) => (
              <div key={p.email} className="row" style={{ gap: 6, flexWrap: "nowrap", fontSize: 13 }}>
                <div style={{ flex: 1, minWidth: 0 }}><div style={{ overflow: "hidden", textOverflow: "ellipsis" }} title={p.email}>{p.email}</div><div className="dim" style={{ fontSize: 11 }}>{p.label}</div></div>
                {rw && <button className="ghost sm" disabled={busy !== null} onClick={() => invite(p.email)} aria-label={`Send portal invitation to ${p.email}`}><Send /> {busy === p.email ? "…" : "Invite"}</button>}
              </div>
            ))}
        </div>
      )}
      {d.events.length > 0 && (
        <details>
          <summary className="dim" style={{ fontSize: 12, cursor: "pointer" }}>Portal activity ({d.events.length})</summary>
          <ul style={{ margin: "6px 0 0", paddingLeft: 16, fontSize: 12 }}>
            {d.events.map((e) => <li key={e.id}>{when(e.at)} · {e.email} {KIND[e.kind] ?? e.kind}{e.number ? <> <Link className="mono" href={`/crm/${e.type}s/${e.document_id}`}>{e.number}</Link></> : ""}</li>)}
          </ul>
        </details>
      )}
    </section>
  );
}

type Notice = { id: string; document_id: string; number: string; client_name: string | null; email: string; amount: number; date: string; reference: string; note: string; currency: Currency;
  total: number; amount_paid: number; attachment_id: string | null; file_name: string | null; status: string; created_at: string; handled_by_name: string | null };

/** Invoice editor: payment notices sent from the portal, with one-click record/dismiss. */
export function NoticesPanel({ docId, onRecorded }: { docId: string; onRecorded: () => void }) {
  const { me, toast } = useCrm();
  const [rows, setRows] = useState<Notice[]>([]);
  const [rec, setRec] = useState<Notice | null>(null);
  const load = useCallback(() => crmFetch<Notice[]>(`/api/crm/documents/${docId}/notices`).then(setRows).catch(() => setRows([])), [docId]);
  useEffect(() => { load(); }, [load]);
  if (!rows.length) return null;
  const mark = async (n: Notice, status: "recorded" | "dismissed") => {
    try { await crmFetch(`/api/crm/payment-notices/${n.id}`, { method: "PATCH", body: { status } }); load(); } catch (e) { toast(errText(e), "err"); }
  };
  const open = rows.filter((n) => n.status === "new");
  return (
    <section className="card stack" style={open.length ? { borderColor: "var(--warn)" } : undefined} aria-label="Payment notices from the client">
      <h2 style={{ margin: 0 }}>Reported by the client{open.length ? ` (${open.length} new)` : ""}</h2>
      {rows.map((n) => (
        <div key={n.id} className="stack" style={{ gap: 4, fontSize: 13, borderBottom: "1px solid var(--line)", paddingBottom: 8 }}>
          <div><b className="tabular">{formatMoney(Number(n.amount), n.currency)}</b> paid {formatDate(n.date)}{n.reference ? ` · ref ${n.reference}` : ""}</div>
          <div className="dim" style={{ fontSize: 12 }}>{n.email} · {when(n.created_at)}</div>
          {n.note && <div style={{ fontSize: 12 }} className="pre">{n.note}</div>}
          {n.attachment_id && <a href={`/api/crm/attachments/${n.attachment_id}/download?inline=1`} target="_blank" rel="noopener" style={{ fontSize: 12 }}><ExternalLink aria-hidden style={{ width: 12, height: 12 }} /> {n.file_name ?? "Proof of payment"}</a>}
          {n.status === "new" ? (canWrite(me?.role) && <div className="row" style={{ gap: 6 }}>
            <button className="sm primary" onClick={() => setRec(n)}><Check /> Record payment</button>
            <button className="sm ghost" onClick={() => confirmAction("Dismiss this notice without recording a payment?") && mark(n, "dismissed")}><X /> Dismiss</button>
          </div>) : <span className={"badge " + (n.status === "recorded" ? "ok" : "")}>{n.status}{n.handled_by_name ? ` · ${n.handled_by_name.split(" ")[0]}` : ""}</span>}
        </div>
      ))}
      {rec && <RecordPaymentModal invoice={{ id: rec.document_id, number: rec.number, currency: rec.currency, balance: Math.max(0, Number(rec.total) - Number(rec.amount_paid)) }}
        initial={{ date: rec.date, amount: Number(rec.amount), reference: rec.reference, notes: `Reported in the client portal by ${rec.email}` }}
        onClose={() => setRec(null)} onSaved={async () => { await mark(rec, "recorded"); setRec(null); onRecorded(); }} />}
    </section>
  );
}

/** Payments page: new portal payment notices across all invoices. */
export function NoticesBanner() {
  const [rows, setRows] = useState<Notice[]>([]);
  useEffect(() => { crmFetch<Notice[]>("/api/crm/payment-notices?status=new").then(setRows).catch(() => {}); }, []);
  if (!rows.length) return null;
  return (
    <div className="warn-box stack" style={{ gap: 4, marginBottom: 12 }} role="status">
      <b>{rows.length} payment{rows.length > 1 ? "s" : ""} reported by clients in the portal, waiting to be checked against the bank statement:</b>
      {rows.map((n) => <div key={n.id} style={{ fontSize: 13 }}><Link className="mono" href={`/crm/invoices/${n.document_id}`}>{n.number}</Link> · {n.client_name ?? n.email} · {formatMoney(Number(n.amount), n.currency)} on {formatDate(n.date)}</div>)}
    </div>
  );
}
