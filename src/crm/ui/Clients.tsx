"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Calendar, FileText, Mail, MessageSquare, Pencil, Phone, Plus, Settings2, Star, Trash2, Users } from "lucide-react";
import { crmFetch } from "./api";
import { canWrite, errText, useCrm } from "./store";
import { confirmAction, Empty, Field, Modal, Money, PageHead, StatusBadge, Tabs } from "./ui";
import { formatDate } from "@/crm/shared/calc";
import { CURRENCIES, RETAINER_LABEL, type Activity, type Client, type Contact, type Currency, type RetainerKind } from "@/crm/shared/types";

const blankClient: Partial<Client> = { name: "", trading_name: "", industry: "", address: "", email: "", phone: "", website: "", vat_no: "", reg_no: "", currency: "NAD", payment_terms_days: null, notes: "", tags: [], archived: false };

export function ClientModal({ initial, onClose, onSaved }: { initial: Partial<Client>; onClose: () => void; onSaved: (c: Client) => void }) {
  const { reload, toast } = useCrm();
  const [f, setF] = useState<Partial<Client>>({ ...blankClient, ...initial });
  const [tags, setTags] = useState((initial.tags ?? []).join(", "));
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<Client>) => setF((x) => ({ ...x, ...p }));
  const save = async () => {
    setBusy(true);
    try {
      const body = { ...f, tags: tags.split(",").map((t) => t.trim()).filter(Boolean) };
      const c = await crmFetch<Client>(f.id ? `/api/crm/clients/${f.id}` : "/api/crm/clients", { method: f.id ? "PUT" : "POST", body });
      await reload("clients");
      toast(f.id ? "Client updated" : "Client added");
      onSaved(c);
    } catch (e) { toast(errText(e), "err"); } finally { setBusy(false); }
  };
  return (
    <Modal title={f.id ? "Edit client" : "New client"} onClose={onClose} footer={<>
      <button onClick={onClose}>Cancel</button>
      <button className="primary" disabled={busy || !f.name?.trim()} onClick={save}>{busy ? "Saving…" : "Save"}</button>
    </>}>
      <div className="stack">
        <div className="grid2">
          <Field label="Organisation name"><input autoFocus value={f.name} onChange={(e) => set({ name: e.target.value })} /></Field>
          <Field label="Trading name"><input value={f.trading_name} onChange={(e) => set({ trading_name: e.target.value })} /></Field>
        </div>
        <div className="grid2">
          <Field label="Industry"><input value={f.industry} onChange={(e) => set({ industry: e.target.value })} placeholder="e.g. Mining, Retail / FMCG" /></Field>
          <Field label="Tags (comma separated)"><input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="e.g. upwork, priority" /></Field>
        </div>
        <Field label="Address (printed on documents)"><textarea rows={3} value={f.address} onChange={(e) => set({ address: e.target.value })} /></Field>
        <div className="grid3">
          <Field label="Accounts email"><input type="email" value={f.email} onChange={(e) => set({ email: e.target.value })} /></Field>
          <Field label="Phone"><input value={f.phone} onChange={(e) => set({ phone: e.target.value })} /></Field>
          <Field label="Website"><input value={f.website} onChange={(e) => set({ website: e.target.value })} /></Field>
        </div>
        <div className="grid4">
          <Field label="VAT no."><input value={f.vat_no} onChange={(e) => set({ vat_no: e.target.value })} /></Field>
          <Field label="Registration no."><input value={f.reg_no} onChange={(e) => set({ reg_no: e.target.value })} /></Field>
          <Field label="Billing currency"><select value={f.currency} onChange={(e) => set({ currency: e.target.value as Currency })}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
          <Field label="Payment terms (days)" hint="Blank = company default"><input type="number" min={0} max={365} value={f.payment_terms_days ?? ""} onChange={(e) => set({ payment_terms_days: e.target.value === "" ? null : Number(e.target.value) })} /></Field>
        </div>
        <Field label="Notes"><textarea rows={3} value={f.notes} onChange={(e) => set({ notes: e.target.value })} /></Field>
        {f.id && <label className="check"><input type="checkbox" checked={!!f.archived} onChange={(e) => set({ archived: e.target.checked })} /> Archived (hidden from pickers)</label>}
      </div>
    </Modal>
  );
}

export function ClientsScreen() {
  const router = useRouter();
  const { clients, ensure, me } = useCrm();
  const [q, setQ] = useState("");
  const [archived, setArchived] = useState(false);
  const [edit, setEdit] = useState<Partial<Client> | null>(null);
  useEffect(() => { ensure(["clients"]); }, [ensure]);
  const list = useMemo(() => clients.filter((c) => (archived || !c.archived) && `${c.name} ${c.trading_name} ${c.industry} ${c.email} ${c.tags.join(" ")} ${c.primary_contact?.name ?? ""}`.toLowerCase().includes(q.toLowerCase())), [clients, q, archived]);
  return (
    <>
      <PageHead title="Clients & Contacts">{canWrite(me?.role) && <button className="primary" onClick={() => setEdit({})}><Plus /> New client</button>}</PageHead>
      <div className="filters">
        <input type="search" placeholder="Search clients, contacts, tags…" value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="check"><input type="checkbox" checked={archived} onChange={(e) => setArchived(e.target.checked)} /> Show archived</label>
      </div>
      <div className="card flush">
        {!list.length ? <Empty>{clients.length ? "No clients match." : "No clients yet. Add your first client."}</Empty> : (
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>Client</th><th>Primary contact</th><th>Industry</th><th className="r">Open projects</th><th className="r">Documents</th><th className="r">Outstanding (NAD)</th></tr></thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.id} className="click" onClick={() => router.push(`/crm/clients/${c.id}`)} style={c.archived ? { opacity: 0.55 } : undefined}>
                  <td><b>{c.name}</b>{c.tags.map((t) => <span key={t} className="badge" style={{ marginLeft: 6 }}>{t}</span>)}{c.archived && <span className="badge" style={{ marginLeft: 6 }}>archived</span>}</td>
                  <td>{c.primary_contact ? <>{c.primary_contact.name}<div className="dim" style={{ fontSize: 12 }}>{c.primary_contact.email}</div></> : <span className="dim">—</span>}</td>
                  <td className="muted">{c.industry || "—"}</td>
                  <td className="r tabular">{c.open_projects || ""}</td>
                  <td className="r tabular">{c.doc_count || ""}</td>
                  <td className="r">{Number(c.outstanding_nad) > 0 ? <Money v={Number(c.outstanding_nad)} c="NAD" /> : <span className="dim">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>
      {edit && <ClientModal initial={edit} onClose={() => setEdit(null)} onSaved={(c) => { setEdit(null); router.push(`/crm/clients/${c.id}`); }} />}
    </>
  );
}

type Detail = {
  client: Client;
  contacts: Contact[];
  documents: { id: string; type: "invoice" | "quote"; number: string; status: string; date: string; due_date: string; currency: Currency; fx_rate: number | null; total: number; amount_paid?: number }[];
  projects: { id: string; title: string; status: string; priority: string; due_date: string | null }[];
  retainers: { id: string; name: string; kind: RetainerKind; currency: Currency; active: boolean; auto: boolean }[];
  activities: Activity[];
};

const ACT_ICON = { note: MessageSquare, call: Phone, email: Mail, meeting: Calendar, system: Settings2 };

export function Timeline({ entity, entityId, items, onChange }: { entity: "client" | "project" | "lead" | "enquiry" | "opportunity"; entityId: string; items: Activity[]; onChange: () => void }) {
  const { me, toast } = useCrm();
  const [kind, setKind] = useState<"note" | "call" | "email" | "meeting">("note");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const add = async () => {
    setBusy(true);
    try { await crmFetch("/api/crm/activities", { method: "POST", body: { entity, entity_id: entityId, kind, body } }); setBody(""); onChange(); } catch (e) { toast(errText(e), "err"); } finally { setBusy(false); }
  };
  const del = async (a: Activity) => {
    if (!confirmAction("Delete this note?")) return;
    try { await crmFetch(`/api/crm/activities/${a.id}`, { method: "DELETE" }); onChange(); } catch (e) { toast(errText(e), "err"); }
  };
  const when = (iso: string) => new Intl.DateTimeFormat("en-NA", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Windhoek" }).format(new Date(iso));
  return (
    <div className="stack">
      {canWrite(me?.role) && (
        <div className="stack" style={{ gap: 6 }}>
          <div className="seg" role="group" aria-label="Activity type">
            {(["note", "call", "email", "meeting"] as const).map((k) => <button key={k} className={kind === k ? "on" : ""} onClick={() => setKind(k)} style={{ textTransform: "capitalize" }}>{k}</button>)}
          </div>
          <textarea rows={2} value={body} onChange={(e) => setBody(e.target.value)} placeholder={kind === "call" ? "Who you spoke to and what was agreed…" : kind === "meeting" ? "Meeting summary and next steps…" : "Add a note…"} />
          <div className="row"><button className="primary sm" disabled={busy || !body.trim()} onClick={add}>Log {kind}</button></div>
        </div>
      )}
      {!items.length ? <div className="dim" style={{ fontSize: 13 }}>No activity yet.</div> : (
        <ul className="timeline">
          {items.map((a) => {
            const Icon = ACT_ICON[a.kind] ?? MessageSquare;
            return (
              <li key={a.id} className={a.kind === "system" ? "system" : ""}>
                <span className="ic"><Icon /></span>
                <div>
                  <div className="pre">{a.body}</div>
                  <div className="dim" style={{ fontSize: 11 }}>{when(a.at)}{a.user_name ? ` · ${a.user_name}` : ""}
                    {a.kind !== "system" && (a.user_id === me?.id || me?.role === "admin") && <button className="ghost sm" style={{ minHeight: 0, padding: "0 6px" }} onClick={() => del(a)}>delete</button>}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function ClientDetail({ id }: { id: string }) {
  const router = useRouter();
  const { me, toast, reload } = useCrm();
  const [d, setD] = useState<Detail | null>(null);
  const [tab, setTab] = useState<"overview" | "documents" | "projects">("overview");
  const [edit, setEdit] = useState(false);
  const [contact, setContact] = useState<Partial<Contact> | null>(null);
  const rw = canWrite(me?.role);
  const load = useCallback(() => crmFetch<Detail>(`/api/crm/clients/${id}`).then(setD).catch((e) => toast(errText(e), "err")), [id, toast]);
  useEffect(() => { load(); }, [load]);
  if (!d) return <Empty>Loading…</Empty>;
  const c = d.client;
  const outstanding = d.documents.filter((x) => x.type === "invoice" && ["sent", "overdue"].includes(x.status));
  const byCur = (rows: typeof d.documents) => rows.reduce<Record<string, number>>((m, x) => ({ ...m, [x.currency]: (m[x.currency] ?? 0) + Number(x.total) - Number(x.amount_paid ?? 0) }), {});

  const removeClient = async () => {
    if (!confirmAction(`Delete ${c.name}? Clients with documents, projects or retainers are archived instead.`)) return;
    try {
      const r = await crmFetch<{ archived: boolean }>(`/api/crm/clients/${id}`, { method: "DELETE" });
      await reload("clients");
      toast(r.archived ? "Client archived (it has history)" : "Client deleted");
      router.push("/crm/clients");
    } catch (e) { toast(errText(e), "err"); }
  };
  const delContact = async (k: Contact) => {
    if (!confirmAction(`Remove ${k.name}?`)) return;
    try { await crmFetch(`/api/crm/contacts/${k.id}`, { method: "DELETE" }); load(); } catch (e) { toast(errText(e), "err"); }
  };

  return (
    <>
      <div className="page-head">
        <Link href="/crm/clients" className="btn ghost icon" aria-label="Back to clients"><ArrowLeft /></Link>
        <h1>{c.name}{c.archived && <span className="badge" style={{ marginLeft: 8, verticalAlign: "middle" }}>archived</span>}</h1>
        {rw && <>
          <Link className="btn" href={`/crm/quotes/new?client_id=${c.id}`}><FileText /> New quote</Link>
          <Link className="btn" href={`/crm/invoices/new?client_id=${c.id}`}><FileText /> New invoice</Link>
          <Link className="btn" href={`/crm/print/statement?client_id=${c.id}`}><FileText /> Statement</Link>
          <button onClick={() => setEdit(true)}><Pencil /> Edit</button>
        </>}
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[{ key: "overview", label: "Overview" }, { key: "documents", label: `Documents (${d.documents.length})` }, { key: "projects", label: `Projects & retainers (${d.projects.length + d.retainers.length})` }]} />

      {tab === "overview" && (
        <div className="split">
          <div className="stack">
            <section className="card">
              <h2>Activity</h2>
              <Timeline entity="client" entityId={c.id} items={d.activities} onChange={load} />
            </section>
          </div>
          <aside className="stack">
            <section className="card">
              <h2>Details</h2>
              <dl className="kv">
                {c.trading_name && <><dt>Trading as</dt><dd>{c.trading_name}</dd></>}
                <dt>Industry</dt><dd>{c.industry || "—"}</dd>
                <dt>Email</dt><dd>{c.email ? <a href={`mailto:${c.email}`}>{c.email}</a> : "—"}</dd>
                <dt>Phone</dt><dd>{c.phone || "—"}</dd>
                {c.website && <><dt>Website</dt><dd>{c.website}</dd></>}
                <dt>Address</dt><dd className="pre">{c.address || "—"}</dd>
                <dt>VAT / Reg.</dt><dd>{[c.vat_no, c.reg_no].filter(Boolean).join(" · ") || "—"}</dd>
                <dt>Billing</dt><dd>{c.currency}{c.payment_terms_days != null ? ` · ${c.payment_terms_days} days` : " · default terms"}</dd>
                <dt>Outstanding</dt><dd>{outstanding.length ? Object.entries(byCur(outstanding)).map(([k, v]) => <div key={k}><Money v={v} c={k} /></div>) : "Nothing due"}</dd>
              </dl>
              {c.notes && <p className="muted pre" style={{ fontSize: 13, marginBottom: 0 }}>{c.notes}</p>}
            </section>
            <section className="card">
              <div className="row" style={{ marginBottom: 8 }}><h2 style={{ margin: 0, flex: 1 }}><Users style={{ width: 15, height: 15, verticalAlign: -2 }} /> Contacts</h2>{rw && <button className="sm" onClick={() => setContact({})}><Plus /> Add</button>}</div>
              {!d.contacts.length ? <div className="dim" style={{ fontSize: 13 }}>No contacts yet.</div> : (
                <ul className="timeline">
                  {d.contacts.map((k) => (
                    <li key={k.id} style={{ gridTemplateColumns: "18px 1fr auto" }}>
                      <span className="ic">{k.is_primary ? <Star style={{ color: "var(--warn)" }} aria-label="Primary" /> : null}</span>
                      <div><b>{k.name}</b>{k.role && <span className="muted"> · {k.role}</span>}
                        <div className="dim" style={{ fontSize: 12 }}>{[k.email, k.phone].filter(Boolean).join(" · ")}</div>
                        {k.notes && <div className="muted pre" style={{ fontSize: 12 }}>{k.notes}</div>}</div>
                      {rw && <div className="nowrap"><button className="ghost icon sm" aria-label={`Edit ${k.name}`} onClick={() => setContact(k)}><Pencil /></button><button className="ghost icon sm danger" aria-label={`Remove ${k.name}`} onClick={() => delContact(k)}><Trash2 /></button></div>}
                    </li>
                  ))}
                </ul>
              )}
            </section>
            {rw && <button className="ghost danger sm" style={{ alignSelf: "flex-start" }} onClick={removeClient}><Trash2 /> Delete or archive client</button>}
          </aside>
        </div>
      )}

      {tab === "documents" && (
        <div className="card flush">
          {!d.documents.length ? <Empty>No quotes or invoices yet.</Empty> : (
            <div className="tbl-wrap"><table className="tbl">
              <thead><tr><th>Number</th><th>Type</th><th>Date</th><th>Due / valid</th><th>Status</th><th className="r">Total</th><th className="r">Balance</th></tr></thead>
              <tbody>{d.documents.map((x) => (
                <tr key={x.id} className="click" onClick={() => router.push(`/crm/${x.type}s/${x.id}`)}>
                  <td className="mono">{x.number}</td><td style={{ textTransform: "capitalize" }}>{x.type}</td><td>{formatDate(x.date)}</td><td>{formatDate(x.due_date)}</td>
                  <td><StatusBadge s={x.status} /></td><td className="r"><Money v={Number(x.total)} c={x.currency} /></td>
                  <td className="r">{x.type === "invoice" && ["sent", "overdue"].includes(x.status) ? <Money v={Number(x.total) - Number(x.amount_paid ?? 0)} c={x.currency} /> : <span className="dim">—</span>}</td>
                </tr>))}</tbody>
            </table></div>
          )}
        </div>
      )}

      {tab === "projects" && (
        <div className="grid2">
          <section className="card flush">
            <div style={{ padding: "14px 16px 6px" }}><h2>Projects</h2></div>
            {!d.projects.length ? <Empty>No projects.</Empty> : <table className="tbl"><tbody>{d.projects.map((p) => (
              <tr key={p.id} className="click" onClick={() => router.push(`/crm/projects?open=${p.id}`)}><td><b>{p.title}</b></td><td><StatusBadge s={p.priority} /></td><td className="muted">{p.status.replace(/_/g, " ")}</td><td className="muted">{formatDate(p.due_date)}</td></tr>
            ))}</tbody></table>}
          </section>
          <section className="card flush">
            <div style={{ padding: "14px 16px 6px" }}><h2>Retainers</h2></div>
            {!d.retainers.length ? <Empty>No retainers.</Empty> : <table className="tbl"><tbody>{d.retainers.map((r) => (
              <tr key={r.id} className="click" onClick={() => router.push("/crm/retainers")}><td><b>{r.name}</b></td><td>{RETAINER_LABEL[r.kind]}</td><td>{r.currency}</td><td>{r.active ? <span className="badge ok">{r.auto ? "auto" : "active"}</span> : <span className="badge">paused</span>}</td></tr>
            ))}</tbody></table>}
          </section>
        </div>
      )}

      {edit && <ClientModal initial={c} onClose={() => setEdit(false)} onSaved={() => { setEdit(false); load(); }} />}
      {contact && <ContactModal clientId={c.id} initial={contact} onClose={() => setContact(null)} onSaved={() => { setContact(null); load(); reload("clients"); }} />}
    </>
  );
}

function ContactModal({ clientId, initial, onClose, onSaved }: { clientId: string; initial: Partial<Contact>; onClose: () => void; onSaved: () => void }) {
  const { toast } = useCrm();
  const [f, setF] = useState<Partial<Contact>>({ name: "", role: "", email: "", phone: "", is_primary: false, notes: "", ...initial });
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<Contact>) => setF((x) => ({ ...x, ...p }));
  const save = async () => {
    setBusy(true);
    try {
      await crmFetch(f.id ? `/api/crm/contacts/${f.id}` : `/api/crm/clients/${clientId}/contacts`, { method: f.id ? "PUT" : "POST", body: f });
      toast(f.id ? "Contact updated" : "Contact added");
      onSaved();
    } catch (e) { toast(errText(e), "err"); } finally { setBusy(false); }
  };
  return (
    <Modal title={f.id ? "Edit contact" : "New contact"} onClose={onClose} footer={<><button onClick={onClose}>Cancel</button><button className="primary" disabled={busy || !f.name?.trim()} onClick={save}>{busy ? "Saving…" : "Save"}</button></>}>
      <div className="stack">
        <div className="grid2">
          <Field label="Name"><input autoFocus value={f.name} onChange={(e) => set({ name: e.target.value })} /></Field>
          <Field label="Role"><input value={f.role} onChange={(e) => set({ role: e.target.value })} placeholder="e.g. Operations Manager" /></Field>
          <Field label="Email"><input type="email" value={f.email} onChange={(e) => set({ email: e.target.value })} /></Field>
          <Field label="Phone"><input value={f.phone} onChange={(e) => set({ phone: e.target.value })} /></Field>
        </div>
        <Field label="Notes"><textarea rows={2} value={f.notes} onChange={(e) => set({ notes: e.target.value })} /></Field>
        <label className="check"><input type="checkbox" checked={!!f.is_primary} onChange={(e) => set({ is_primary: e.target.checked })} /> Primary contact</label>
      </div>
    </Modal>
  );
}

