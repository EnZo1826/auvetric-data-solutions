"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FileText, Paperclip, Send } from "lucide-react";
import { crmFetch } from "./api";
import { errText, useCrm } from "./store";
import { Empty, Field, Modal } from "./ui";
import { fmtSize } from "./Attachments";

type Draft = {
  configured: boolean; from: string | null; to: string[]; options: { email: string; label: string }[]; subject: string; body: string; pdf_name: string;
  attachments: { id: string; name: string; size: number }[]; status?: string; warning: string | null; from_date?: string; to_date?: string;
  history: { id: string; kind: string; to_addrs: string[]; subject: string; status: string; error: string; sent_at: string; sent_by_name: string | null }[];
};
const split = (v: string) => v.split(/[,;\s]+/).map((x) => x.trim()).filter(Boolean);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Compose and send a document (invoice/quote) or a client statement, with the PDF attached. */
export function EmailDialog(props: { kind: "document"; docId: string; onClose: () => void; onSent: (status?: string) => void } | { kind: "statement"; clientId: string; from?: string; to?: string; onClose: () => void; onSent: () => void }) {
  const { toast, me } = useCrm();
  const [d, setD] = useState<Draft | null>(null);
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [att, setAtt] = useState<Set<string>>(new Set());
  const [markSent, setMarkSent] = useState(true);
  const [busy, setBusy] = useState(false);
  const base = props.kind === "document" ? `/api/crm/documents/${props.docId}/email`
    : `/api/crm/clients/${props.clientId}/statement/email`;
  const qs = props.kind === "statement" ? `?${new URLSearchParams({ ...(props.from ? { from: props.from } : {}), ...(props.to ? { to: props.to } : {}) })}` : "";
  useEffect(() => {
    crmFetch<Draft>(base + qs).then((r) => { setD(r); setTo(r.to.join(", ")); setSubject(r.subject); setBody(r.body); }).catch((e) => toast(errText(e), "err"));
  }, [base, qs, toast]);

  const toList = split(to), ccList = split(cc);
  const bad = [...toList, ...ccList].filter((x) => !EMAIL.test(x));
  const toggleTo = (email: string) => setTo((v) => { const l = split(v); return (l.includes(email) ? l.filter((x) => x !== email) : [...l, email]).join(", "); });
  const send = async () => {
    setBusy(true);
    try {
      const payload = { to: toList, cc: ccList, subject, body, attachment_ids: [...att], mark_sent: markSent,
        ...(props.kind === "statement" ? { from_date: d?.from_date, to_date: d?.to_date } : {}) };
      const r = await crmFetch<{ status?: string; to: string[] }>(base, { method: "POST", body: payload });
      toast(`Sent to ${r.to.join(", ")}`);
      props.onSent(r.status);
    } catch (e) { toast(errText(e), "err"); } finally { setBusy(false); }
  };
  const draftDoc = props.kind === "document" && d?.status === "draft";

  return (
    <Modal wide title={props.kind === "document" ? "Email document" : "Email statement"} onClose={props.onClose}
      footer={d?.configured ? <><button onClick={props.onClose}>Cancel</button><button className="primary" disabled={busy || !toList.length || bad.length > 0 || !subject.trim() || !body.trim()} onClick={send}><Send /> {busy ? "Sending…" : "Send"}</button></> : <button onClick={props.onClose}>Close</button>}>
      {!d ? <Empty>Loading…</Empty> : !d.configured ? (
        <div className="stack">
          <div className="warn-box">Email isn&apos;t set up yet. {me?.role === "admin" ? <>Add your Zoho mailbox under <Link href="/crm/settings#email">Settings → Email</Link>.</> : "Ask an admin to add the mail server under Settings → Email."}</div>
          <p className="dim" style={{ margin: 0, fontSize: 13 }}>Until then, use Download PDF and attach it in your own mail.</p>
        </div>
      ) : (
        <div className="stack">
          {d.warning && <div className="warn-box">{d.warning}</div>}
          <div className="dim" style={{ fontSize: 12 }}>From <b style={{ color: "var(--text)" }}>{d.from}</b></div>
          <Field label="To" hint={bad.length ? <span style={{ color: "var(--err)" }}>Not a valid address: {bad.join(", ")}</span> : "Separate addresses with commas."}>
            <input value={to} onChange={(e) => setTo(e.target.value)} autoFocus />
          </Field>
          {d.options.length > 0 && (
            <div className="row" style={{ gap: 6, flexWrap: "wrap", marginTop: -4 }} role="group" aria-label="Known addresses">
              {d.options.map((o) => (
                <button key={o.email} type="button" className={"sm" + (toList.includes(o.email) ? " primary" : " ghost")} aria-pressed={toList.includes(o.email)} onClick={() => toggleTo(o.email)} title={o.label}>
                  {o.email} <span className="dim" style={{ fontSize: 11 }}>· {o.label}</span>
                </button>
              ))}
            </div>
          )}
          <Field label="Cc"><input value={cc} onChange={(e) => setCc(e.target.value)} placeholder="optional" /></Field>
          <Field label="Subject"><input value={subject} onChange={(e) => setSubject(e.target.value)} /></Field>
          <Field label="Message"><textarea rows={10} value={body} onChange={(e) => setBody(e.target.value)} /></Field>
          <div className="stack" style={{ gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 500 }}>Attachments</span>
            <div style={{ fontSize: 13 }}><FileText aria-hidden style={{ width: 14, height: 14, verticalAlign: -2 }} /> {d.pdf_name} <span className="dim">(always attached)</span></div>
            {d.attachments.map((a) => (
              <label key={a.id} className="check" style={{ fontSize: 13 }}>
                <input type="checkbox" checked={att.has(a.id)} onChange={() => setAtt((s) => { const n = new Set(s); if (n.has(a.id)) n.delete(a.id); else n.add(a.id); return n; })} />
                <Paperclip aria-hidden style={{ width: 13, height: 13 }} /> {a.name} <span className="dim">{fmtSize(a.size)}</span>
              </label>
            ))}
          </div>
          {draftDoc && <label className="check"><input type="checkbox" checked={markSent} onChange={(e) => setMarkSent(e.target.checked)} /> Mark as sent</label>}
          {d.history.length > 0 && (
            <details>
              <summary className="dim" style={{ fontSize: 12, cursor: "pointer" }}>Sent before ({d.history.length})</summary>
              <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 12 }}>
                {d.history.map((h) => (
                  <li key={h.id}>{new Date(h.sent_at).toLocaleString("en-NA", { timeZone: "Africa/Windhoek", dateStyle: "medium", timeStyle: "short" })} · {h.to_addrs.join(", ")}
                    {h.sent_by_name ? ` · ${h.sent_by_name.split(" ")[0]}` : ""} {h.status === "failed" ? <span style={{ color: "var(--err)" }}>· failed: {h.error.slice(0, 160)}</span> : null}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </Modal>
  );
}
