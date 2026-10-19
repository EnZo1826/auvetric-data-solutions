"use client";

import { AttachmentsPanel } from "./Attachments";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Building2, Copy, KanbanSquare, Plus, RefreshCw, Trash2 } from "lucide-react";
import { crmFetch } from "./api";
import { canWrite, errText, useCrm } from "./store";
import { confirmAction, Empty, Field, Modal, PageHead, StatusBadge, Tabs } from "./ui";
import { Timeline } from "./Clients";
import { TaskPanel } from "./Tasks";
import { practiceLabel, type Activity } from "@/crm/shared/types";
import type { Enquiry } from "@/crm/shared/sales";

const when = (iso: string) => new Intl.DateTimeFormat("en-NA", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Windhoek" }).format(new Date(iso));
const PRIORITY_TONE: Record<string, string> = { high: "ok", normal: "info", low: "" };

export function TriageBadge({ e }: { e: Pick<Enquiry, "triage_status" | "ai" | "status"> }) {
  if (e.triage_status === "done") {
    const spam = Number(e.ai.spam_score ?? 0);
    return <>
      {e.ai.priority && <span className={"badge " + (PRIORITY_TONE[e.ai.priority] ?? "")}>{e.ai.priority}</span>}{" "}
      {e.ai.category && <span className="badge">{e.ai.category.replace(/_/g, " ")}</span>}{" "}
      {spam >= 40 && <span className={"badge " + (spam >= 70 ? "err" : "warn")}>spam {spam}</span>}
    </>;
  }
  if (e.triage_status === "failed") return <span className="badge err" title={e.ai.error}>AI triage failed</span>;
  return <span className="badge mute" title="Waiting for n8n on the partners' PC">awaiting AI triage</span>;
}

export function EnquiriesScreen() {
  const router = useRouter();
  const search = useSearchParams();
  const { me, toast } = useCrm();
  const [status, setStatus] = useState("open");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Enquiry[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const load = useCallback(() => {
    const qs = new URLSearchParams({ status });
    if (q.trim()) qs.set("q", q.trim());
    return crmFetch<Enquiry[]>(`/api/crm/enquiries?${qs}`).then(setRows).catch((e) => toast(errText(e), "err"));
  }, [status, q, toast]);
  useEffect(() => { const t = setTimeout(load, q ? 250 : 0); return () => clearTimeout(t); }, [load, q]);
  useEffect(() => { const o = search.get("open"); if (o && /^\d+$/.test(o)) { setOpen(o); router.replace("/crm/enquiries"); } }, [search, router]);

  return (
    <>
      <PageHead title="Enquiries">{canWrite(me?.role) && <button className="primary" onClick={() => setAdding(true)}><Plus /> Log enquiry</button>}</PageHead>
      <div className="filters">
        <Tabs value={status} onChange={setStatus} tabs={[{ key: "open", label: "Inbox" }, { key: "converted", label: "Converted" }, { key: "spam", label: "Spam" }, { key: "archived", label: "Archived" }, { key: "", label: "All" }]} />
        <input type="search" placeholder="Search name, organisation, email, message…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="card flush">
        {rows === null ? <Empty>Loading…</Empty> : !rows.length ? <Empty>{status === "open" ? "No open enquiries. Website form submissions appear here as they arrive." : "Nothing here."}</Empty> : (
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>Received</th><th>From</th><th>Interest</th><th>Summary</th><th>Triage</th><th>Status</th></tr></thead>
            <tbody>{rows.map((e) => (
              <tr key={e.id} className="click" onClick={() => setOpen(e.id)} style={e.status === "new" ? { fontWeight: 500 } : undefined}>
                <td className="nowrap muted">{when(e.submitted_at)}</td>
                <td><b style={{ fontWeight: 600 }}>{e.name}</b>{e.organisation && <div className="dim" style={{ fontSize: 12 }}>{e.organisation}</div>}</td>
                <td className="muted" style={{ fontSize: 12 }}>{e.interest || "—"}{e.budget && e.budget !== "Not specified" && <div className="dim">{e.budget}</div>}</td>
                <td style={{ fontSize: 13, maxWidth: 420 }}>{(e.ai.summary || e.message).slice(0, 180)}{(e.ai.summary || e.message).length > 180 ? "…" : ""}</td>
                <td className="nowrap"><TriageBadge e={e} /></td>
                <td><StatusBadge s={e.status} /></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </div>
      {open && <EnquiryModal id={open} onClose={() => setOpen(null)} onChanged={load} />}
      {adding && <NewEnquiryModal onClose={() => setAdding(false)} onSaved={(id) => { setAdding(false); load(); setOpen(id); }} />}
    </>
  );
}

function NewEnquiryModal({ onClose, onSaved }: { onClose: () => void; onSaved: (id: string) => void }) {
  const { toast } = useCrm();
  const [f, setF] = useState({ name: "", organisation: "", email: "", phone: "", interest: "", budget: "", timeline: "", message: "", intent: "Phone / email" });
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  const save = async () => {
    setBusy(true);
    try { const e = await crmFetch<Enquiry>("/api/crm/enquiries", { method: "POST", body: f }); toast("Enquiry logged; n8n will triage it"); onSaved(e.id); } catch (e) { toast(errText(e), "err"); } finally { setBusy(false); }
  };
  return (
    <Modal title="Log an enquiry" onClose={onClose} footer={<><button onClick={onClose}>Cancel</button><button className="primary" disabled={busy || !f.name.trim() || !f.message.trim()} onClick={save}>{busy ? "Saving…" : "Save"}</button></>}>
      <div className="stack">
        <p className="dim" style={{ margin: 0, fontSize: 12 }}>For enquiries that arrive by phone, email or in person. The AI triage runs on it like a website enquiry.</p>
        <div className="grid2">
          <Field label="Name"><input autoFocus value={f.name} onChange={(e) => set({ name: e.target.value })} /></Field>
          <Field label="Organisation"><input value={f.organisation} onChange={(e) => set({ organisation: e.target.value })} /></Field>
          <Field label="Email"><input type="email" value={f.email} onChange={(e) => set({ email: e.target.value })} /></Field>
          <Field label="Phone"><input value={f.phone} onChange={(e) => set({ phone: e.target.value })} /></Field>
        </div>
        <div className="grid3">
          <Field label="Area of interest"><input value={f.interest} onChange={(e) => set({ interest: e.target.value })} /></Field>
          <Field label="Budget"><input value={f.budget} onChange={(e) => set({ budget: e.target.value })} /></Field>
          <Field label="Timeline"><input value={f.timeline} onChange={(e) => set({ timeline: e.target.value })} /></Field>
        </div>
        <Field label="What they need"><textarea rows={6} value={f.message} onChange={(e) => set({ message: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}

type Detail = { enquiry: Enquiry & { client_name: string | null; lead_title: string | null }; activities: Activity[] };

function EnquiryModal({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const router = useRouter();
  const { me, toast } = useCrm();
  const [d, setD] = useState<Detail | null>(null);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const rw = canWrite(me?.role);
  const load = useCallback(() => crmFetch<Detail>(`/api/crm/enquiries/${id}`).then((x) => { setD(x); setNotes(x.enquiry.notes); }).catch((e) => { toast(errText(e), "err"); onClose(); }), [id, toast, onClose]);
  useEffect(() => { load(); }, [load]);

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try { await fn(); toast(ok); await load(); onChanged(); } catch (e) { toast(errText(e), "err"); } finally { setBusy(false); }
  };
  if (!d) return <Modal title="Enquiry" onClose={onClose}><Empty>Loading…</Empty></Modal>;
  const e = d.enquiry;
  const ai = e.ai;
  const patch = (body: Record<string, unknown>, ok: string) => act(() => crmFetch(`/api/crm/enquiries/${id}`, { method: "PATCH", body }), ok);
  const copyReply = async () => {
    try { await navigator.clipboard.writeText(ai.suggested_reply ?? ""); toast("Draft reply copied"); } catch { toast("Couldn't copy. Select the text instead.", "err"); }
  };
  const mailto = e.email ? `mailto:${encodeURIComponent(e.email)}?subject=${encodeURIComponent("Re: your enquiry to Auvetric Data Solutions")}&body=${encodeURIComponent(ai.suggested_reply ?? "")}` : null;

  return (
    <Modal wide title={<>{e.name}{e.organisation ? <span className="muted" style={{ fontWeight: 400 }}> · {e.organisation}</span> : null}</>} onClose={onClose} footer={<>
      {me?.role === "admin" && <button className="danger" style={{ marginRight: "auto" }} disabled={busy} onClick={() => confirmAction("Delete this enquiry permanently? Use this for erasure requests; otherwise archive it.") && act(async () => { await crmFetch(`/api/crm/enquiries/${id}`, { method: "DELETE" }); onClose(); }, "Enquiry deleted")}><Trash2 /> Delete</button>}
      {rw && e.status !== "archived" && <button disabled={busy} onClick={() => patch({ status: "archived" }, "Archived")}>Archive</button>}
      {rw && e.status !== "spam" && <button disabled={busy} onClick={() => patch({ status: "spam" }, "Marked as spam")}>Spam</button>}
      {rw && (e.status === "spam" || e.status === "archived") && <button disabled={busy} onClick={() => patch({ status: "reviewed" }, "Moved to inbox")}>Back to inbox</button>}
      {rw && e.status === "new" && <button disabled={busy} onClick={() => patch({ status: "reviewed" }, "Marked reviewed")}>Mark reviewed</button>}
      {rw && (e.lead_id ? <Link className="btn primary" href={`/crm/leads?open=${e.lead_id}`}><KanbanSquare /> Open lead</Link>
        : <button className="primary" disabled={busy} onClick={() => act(async () => { const l = await crmFetch<{ id: string }>(`/api/crm/enquiries/${id}/lead`, { method: "POST" }); router.push(`/crm/leads?open=${l.id}`); }, "Lead created")}><KanbanSquare /> Convert to lead</button>)}
    </>}>
      <div className="split">
        <div className="stack">
          <section className="card stack" style={{ gap: 8 }}>
            <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
              <h2 style={{ margin: 0 }}>AI triage</h2>
              <div><TriageBadge e={e} /> {ai.practice && <span className="badge">{practiceLabel(ai.practice) !== "—" ? practiceLabel(ai.practice).split(" ")[0] : ai.practice}</span>}</div>
            </div>
            {e.triage_status === "done" ? <>
              <p style={{ margin: 0 }} className="pre">{ai.summary}</p>
              {ai.key_requirements && <div><div className="dim" style={{ fontSize: 11, textTransform: "uppercase" }}>Key requirements</div><div className="pre" style={{ fontSize: 13 }}>{ai.key_requirements}</div></div>}
              {ai.questions_to_ask && <div><div className="dim" style={{ fontSize: 11, textTransform: "uppercase" }}>Questions to ask</div><div className="pre" style={{ fontSize: 13 }}>{ai.questions_to_ask}</div></div>}
            </> : <p className="dim" style={{ margin: 0, fontSize: 13 }}>
              {e.triage_status === "failed" ? `The local AI model couldn't triage this enquiry after ${e.triage_attempts} attempts${ai.error ? ` (${ai.error})` : ""}.` : "n8n on the partners' PC picks this up within about five minutes of the PC being on, then emails both partners."}
            </p>}
            {rw && e.triage_status !== "pending" && e.triage_status !== "claimed" && <div><button className="sm" disabled={busy} onClick={() => act(() => crmFetch(`/api/crm/enquiries/${id}/retriage`, { method: "POST" }), "Queued for AI triage")}><RefreshCw /> Triage again</button></div>}
          </section>
          <section className="card stack" style={{ gap: 6 }}>
            <h2 style={{ margin: 0 }}>Message</h2>
            <div className="pre" style={{ fontSize: 14 }}>{e.message}</div>
          </section>
          {ai.suggested_reply && (
            <section className="card stack" style={{ gap: 6 }}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <h2 style={{ margin: 0 }}>Draft reply <span className="dim" style={{ fontSize: 12, fontWeight: 400 }}>review before sending</span></h2>
                <div className="row" style={{ gap: 6 }}>
                  <button className="sm" onClick={copyReply}><Copy /> Copy</button>
                  {mailto && <a className="btn sm" href={mailto}>Open in mail</a>}
                </div>
              </div>
              <div className="pre" style={{ fontSize: 13 }}>{ai.suggested_reply}</div>
            </section>
          )}
          <section className="card stack" style={{ gap: 6 }}>
            <h2 style={{ margin: 0 }}>Activity</h2>
            <Timeline entity="enquiry" entityId={e.id} items={d.activities} onChange={load} />
            <div style={{ marginTop: 12 }}><AttachmentsPanel entity="enquiry" entityId={e.id} /></div>
          </section>
        </div>
        <div className="stack">
          <section className="card">
            <dl className="kv">
              <dt>Received</dt><dd>{when(e.submitted_at)} <span className="dim">({e.source})</span></dd>
              <dt>Email</dt><dd>{e.email ? <a href={`mailto:${e.email}`}>{e.email}</a> : "—"}</dd>
              <dt>Phone</dt><dd>{e.phone ? <a href={`tel:${e.phone.replace(/\s/g, "")}`}>{e.phone}</a> : "—"}</dd>
              <dt>Intent</dt><dd>{e.intent || "—"}</dd>
              <dt>Interest</dt><dd>{e.interest || "—"}</dd>
              <dt>Budget</dt><dd>{e.budget || "—"}</dd>
              <dt>Timeline</dt><dd>{e.timeline || "—"}</dd>
              <dt>Status</dt><dd><StatusBadge s={e.status} /></dd>
              <dt>Client</dt><dd>{e.client_id ? <Link href={`/crm/clients/${e.client_id}`}>{e.client_name}</Link>
                : rw ? <button className="sm" disabled={busy} onClick={() => act(() => crmFetch(`/api/crm/enquiries/${id}/client`, { method: "POST" }), "Client created")}><Building2 /> Create client</button> : "—"}</dd>
              <dt>Lead</dt><dd>{e.lead_id ? <Link href={`/crm/leads?open=${e.lead_id}`}>{e.lead_title}</Link> : "—"}</dd>
            </dl>
          </section>
          <section className="card stack" style={{ gap: 6 }}>
            <h2 style={{ margin: 0 }}>Tasks</h2>
            <TaskPanel entity="enquiry" entityId={e.id} />
          </section>
          <section className="card stack" style={{ gap: 6 }}>
            <h2 style={{ margin: 0 }}>Internal notes</h2>
            <textarea rows={4} value={notes} readOnly={!rw} onChange={(ev) => setNotes(ev.target.value)} />
            {rw && notes !== e.notes && <div><button className="sm primary" disabled={busy} onClick={() => patch({ notes }, "Notes saved")}>Save notes</button></div>}
          </section>
        </div>
      </div>
    </Modal>
  );
}
