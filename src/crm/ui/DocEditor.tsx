"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Copy, Download, Eye, EyeOff, FileOutput, FolderKanban, Mail, Printer, Repeat, Save, Trash2 } from "lucide-react";
import { crmFetch } from "./api";
import { canWrite, errText, useCrm } from "./store";
import { confirmAction, Empty, Field, StatusBadge } from "./ui";
import { LineEditor } from "./LineEditor";
import { DocumentPrint } from "./DocumentPrint";
import { PaymentsPanel } from "./Payments";
import { AttachmentsPanel } from "./Attachments";
import { EmailDialog } from "./EmailDialog";
import { NoticesPanel } from "./PortalAdmin";
import { addDays, computeTotals, formatMoney, todayISO } from "@/crm/shared/calc";
import { CURRENCIES, INVOICE_STATUSES, PROPOSAL_FIELDS, QUOTE_STATUSES, type ClientSnapshot, type Contact, type Currency, type Doc, type DocData, type DocType, type Project } from "@/crm/shared/types";

type Draft = Omit<Doc, "id" | "company_id" | "subtotal" | "vat" | "discount" | "total" | "sent_at" | "paid_at" | "retainer_id" | "source_id" | "period"> & {
  id?: string; retainer_id?: string | null; source_id?: string | null; period?: string | null; clientTouched?: boolean;
};
type Loaded = Doc & { company: { id: string; name: string; data: import("@/crm/shared/types").CompanyData }; source: { id: string; type: DocType; number: string } | null; derived: { id: string; type: DocType; number: string; status: string }[] };

const LOCKED = new Set(["paid", "cancelled", "invoiced"]);
const emptySnap: ClientSnapshot = { name: "", address: "", email: "", phone: "", contact: "", vat_no: "" };

export function DocEditor({ type, docId }: { type: DocType; docId: string }) {
  const router = useRouter();
  const search = useSearchParams();
  const { company, clients, me, ensure, toast, reload } = useCrm();
  const [doc, setDoc] = useState<Draft | null>(null);
  const [meta, setMeta] = useState<Pick<Loaded, "source" | "derived"> & { status: string; project_id: string | null }>({ source: null, derived: [], status: "draft", project_id: null });
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [mailing, setMailing] = useState(false);
  const [preview, setPreview] = useState(false);
  const [snapOpen, setSnapOpen] = useState(false);
  const isNew = docId === "new";
  const base = type === "invoice" ? "/crm/invoices" : "/crm/quotes";
  const label = type === "invoice" ? "Invoice" : "Quote";

  useEffect(() => { ensure(["company", "clients", "services"]); }, [ensure]);
  useEffect(() => { crmFetch<Project[]>("/api/crm/projects").then(setProjects).catch(() => {}); }, []);

  // Load or initialise
  useEffect(() => {
    if (!isNew) {
      crmFetch<Loaded>(`/api/crm/documents/${docId}`).then((d) => {
        if (d.type !== type) { router.replace(`${d.type === "invoice" ? "/crm/invoices" : "/crm/quotes"}/${d.id}`); return; }
        setDoc({ ...d });
        setMeta({ source: d.source, derived: d.derived, status: d.status, project_id: d.project_id });
        setDirty(false);
      }).catch((e) => toast(errText(e), "err"));
      return;
    }
    if (!company) return;
    const cd = company.data;
    const date = todayISO();
    setDoc({
      type, number: "", client_id: search.get("client_id"), contact_id: null, project_id: search.get("project_id"), status: "draft", date,
      due_date: addDays(date, type === "invoice" ? cd.paymentTermsDays || 14 : cd.quoteValidDays || 30),
      currency: cd.defaultCurrency || "NAD", fx_rate: null,
      data: { client: { ...emptySnap }, remarks: "", lines: [], discount: 0, vatRate: cd.vatRegistered ? cd.vatRate : 0, notes: "", ...(type === "quote" ? { proposal: { intro: "", scope: "", deliverables: "", assumptions: "", timeline: "" } } : {}) },
      clientTouched: true,
    });
  }, [docId, isNew, type, company, search, router, toast]);

  // Contacts for the chosen client
  useEffect(() => {
    if (!doc?.client_id) { setContacts([]); return; }
    crmFetch<{ contacts: Contact[] }>(`/api/crm/clients/${doc.client_id}`).then((r) => setContacts(r.contacts)).catch(() => setContacts([]));
  }, [doc?.client_id]);

  // New doc from a client: adopt the client's currency once
  useEffect(() => {
    if (!isNew || !doc?.client_id) return;
    const c = clients.find((x) => x.id === doc.client_id);
    if (c && doc.clientTouched) setDoc((d) => d && { ...d, currency: c.currency, clientTouched: false, due_date: type === "invoice" && c.payment_terms_days != null ? addDays(d.date, c.payment_terms_days) : d.due_date });
  }, [isNew, doc?.client_id, doc?.clientTouched, clients, type]);

  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const set = useCallback((p: Partial<Draft>) => { setDoc((d) => d && { ...d, ...p }); setDirty(true); }, []);
  const setData = useCallback((p: Partial<DocData>) => { setDoc((d) => d && { ...d, data: { ...d.data, ...p } }); setDirty(true); }, []);

  const locked = LOCKED.has(meta.status) && !isNew;
  const rw = canWrite(me?.role) && !locked;
  const cd = company?.data;
  const totals = useMemo(() => (doc ? computeTotals(doc.data.lines, doc.data.vatRate, doc.data.discount) : null), [doc]);
  const client = clients.find((c) => c.id === doc?.client_id);
  const fxRate = doc?.currency === "NAD" ? null : doc?.fx_rate ?? cd?.usdToNad ?? null;

  if (!doc || !company || !cd || !totals) return <Empty>Loading…</Empty>;

  const body = () => ({
    type, number: doc.number || undefined, client_id: doc.client_id, contact_id: doc.contact_id, project_id: doc.project_id, status: doc.status,
    date: doc.date, due_date: doc.due_date, currency: doc.currency, fx_rate: doc.currency === "NAD" ? null : fxRate,
    data: { ...doc.data, client: snapOpen || !doc.client_id ? doc.data.client : undefined },
  });

  const save = async (): Promise<string | null> => {
    if (!doc.client_id && !doc.data.client.name.trim()) { toast("Choose a client first.", "err"); return null; }
    setBusy(true);
    try {
      const saved = await crmFetch<Doc>(isNew ? "/api/crm/documents" : `/api/crm/documents/${docId}`, { method: isNew ? "POST" : "PUT", body: body() });
      setDirty(false);
      toast(`${label} ${saved.number} saved`);
      if (isNew) router.replace(`${base}/${saved.id}`);
      else { setDoc({ ...saved }); setMeta((m) => ({ ...m, status: saved.status, project_id: saved.project_id })); }
      reload("company");
      return saved.id;
    } catch (e) { toast(errText(e), "err"); return null; } finally { setBusy(false); }
  };

  const action = async (path: string, ok: string, go?: (r: { id: string; type?: DocType }) => string) => {
    if (dirty && !(await save())) return;
    setBusy(true);
    try {
      const r = await crmFetch<{ id: string; type?: DocType }>(`/api/crm/documents/${docId}/${path}`, { method: "POST", body: {} });
      toast(ok);
      if (go) router.push(go(r));
    } catch (e) { toast(errText(e), "err"); } finally { setBusy(false); }
  };

  const setStatus = async (s: string) => {
    if (s === "cancelled" && !confirmAction(`Cancel ${doc.number}? Cancelled invoices are kept for the record and can't be edited.`)) return;
    try {
      const r = await crmFetch<Doc>(`/api/crm/documents/${docId}/status`, { method: "PATCH", body: { status: s } });
      setDoc((d) => d && { ...d, status: r.status });
      setMeta((m) => ({ ...m, status: r.status }));
      toast(`Marked ${s}`);
    } catch (e) { toast(errText(e), "err"); }
  };

  const remove = async () => {
    if (!confirmAction(`Delete draft ${doc.number}?`)) return;
    try { await crmFetch(`/api/crm/documents/${docId}`, { method: "DELETE" }); toast("Deleted"); router.push(base); } catch (e) { toast(errText(e), "err"); }
  };

  const printable = { type, number: doc.number || "(assigned on save)", date: doc.date, due_date: doc.due_date, currency: doc.currency, data: { ...doc.data, client: doc.data.client.name ? doc.data.client : { ...emptySnap, name: client?.name ?? "", address: client?.address ?? "", email: client?.email ?? "" } } };
  const statuses: readonly string[] = type === "invoice" ? INVOICE_STATUSES : QUOTE_STATUSES;

  return (
    <>
      <div className="page-head">
        <Link href={base} className="btn ghost icon" aria-label={`Back to ${label.toLowerCase()}s`}><ArrowLeft /></Link>
        <h1>{isNew ? `New ${label.toLowerCase()}` : <>{label} <span className="mono">{doc.number}</span></>}</h1>
        {!isNew && <StatusBadge s={meta.status} />}
        {dirty && <span className="badge warn">unsaved</span>}
        <button className="ghost" onClick={() => setPreview((p) => !p)}>{preview ? <><EyeOff /> Edit</> : <><Eye /> Preview</>}</button>
        {!isNew && <Link className="btn" href={`/crm/print?ids=${docId}`} target="_blank"><Printer /> Print</Link>}
        {!isNew && <a className="btn" href={`/api/crm/documents/${docId}/pdf`} download><Download /> PDF</a>}
        {!isNew && rw && meta.status !== "cancelled" && <button onClick={() => (dirty ? toast("Save your changes before emailing.", "err") : setMailing(true))}><Mail /> Email</button>}
        {rw && <button className="primary" disabled={busy} onClick={save}><Save /> {busy ? "Saving…" : "Save"}</button>}
      </div>

      {locked && <div className="warn-box" style={{ marginBottom: 12 }}>This {label.toLowerCase()} is <b>{meta.status}</b> and can&apos;t be edited. Duplicate it to make changes.</div>}
      {!cd.vatRegistered && type === "invoice" && !locked && <div className="dim" style={{ fontSize: 12, marginBottom: 10 }}>Auvetric is not VAT-registered, so invoices print as “INVOICE” without VAT. Change this in Company profile once registered.</div>}

      {preview ? (
        <div className="print-stage" style={{ padding: 0 }}><DocumentPrint doc={printable} company={company} /></div>
      ) : (
        <div className="split">
          <div className="stack">
            <section className="card stack">
              <div className="grid2">
                <Field label="Client">
                  <select value={doc.client_id ?? ""} disabled={!rw} onChange={(e) => { set({ client_id: e.target.value || null, contact_id: null, clientTouched: true }); setData({ client: { ...emptySnap } }); setSnapOpen(false); }}>
                    <option value="">Choose a client…</option>
                    {clients.filter((c) => !c.archived || c.id === doc.client_id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </Field>
                <Field label="Contact">
                  <select value={doc.contact_id ?? ""} disabled={!rw || !contacts.length} onChange={(e) => set({ contact_id: e.target.value || null })}>
                    <option value="">{contacts.length ? "Primary / none" : "No contacts on file"}</option>
                    {contacts.map((k) => <option key={k.id} value={k.id}>{k.name}{k.role ? ` — ${k.role}` : ""}</option>)}
                  </select>
                </Field>
              </div>
              {!clients.length && <div className="dim" style={{ fontSize: 12 }}>No clients yet. <Link href="/crm/clients">Add a client</Link> first.</div>}
              <details open={snapOpen} onToggle={(e) => setSnapOpen((e.target as HTMLDetailsElement).open)}>
                <summary className="muted" style={{ cursor: "pointer", fontSize: 12 }}>Client details printed on this {label.toLowerCase()}</summary>
                <div className="grid2" style={{ marginTop: 8 }}>
                  {(["name", "contact", "email", "phone", "vat_no"] as const).map((k) => (
                    <Field key={k} label={{ name: "Name", contact: "Attention", email: "Email", phone: "Phone", vat_no: "VAT no." }[k]}>
                      <input value={doc.data.client[k]} readOnly={!rw} placeholder={k === "name" ? client?.name : k === "email" ? client?.email : k === "vat_no" ? client?.vat_no : ""} onChange={(e) => setData({ client: { ...doc.data.client, [k]: e.target.value } })} />
                    </Field>
                  ))}
                  <Field label="Address"><textarea rows={2} value={doc.data.client.address} readOnly={!rw} placeholder={client?.address} onChange={(e) => setData({ client: { ...doc.data.client, address: e.target.value } })} /></Field>
                </div>
                <div className="dim" style={{ fontSize: 11, marginTop: 4 }}>Leave blank to use the client record. Values are frozen on the document when saved.</div>
              </details>
              <Field label={type === "invoice" ? "Reference / remarks (printed)" : "Project / reference (printed)"}>
                <input value={doc.data.remarks} readOnly={!rw} onChange={(e) => setData({ remarks: e.target.value })} placeholder={type === "invoice" ? "e.g. PO 4471 · October support" : "e.g. Fleet telemetry dashboard"} />
              </Field>
            </section>

            {type === "quote" && doc.data.proposal && (
              <section className="card stack">
                <h2 style={{ margin: 0 }}>Proposal sections <span className="dim" style={{ fontSize: 12, fontWeight: 400 }}>optional · printed above the price table</span></h2>
                {PROPOSAL_FIELDS.map((f) => (
                  <Field key={f.key} label={f.label}>
                    <textarea rows={f.key === "scope" ? 4 : 2} value={doc.data.proposal![f.key]} readOnly={!rw} onChange={(e) => setData({ proposal: { ...doc.data.proposal!, [f.key]: e.target.value } })} />
                  </Field>
                ))}
              </section>
            )}

            <section className="card">
              <h2>Lines</h2>
              <LineEditor lines={doc.data.lines} currency={doc.currency} readOnly={!rw} onChange={(lines) => setData({ lines })} />
              <div className="row" style={{ marginTop: 14, alignItems: "flex-start" }}>
                <div className="grid2" style={{ flex: 1, maxWidth: 360 }}>
                  <Field label="Discount (amount)"><input type="number" step="any" min={0} value={doc.data.discount} readOnly={!rw} onChange={(e) => setData({ discount: Number(e.target.value) || 0 })} /></Field>
                  {cd.vatRegistered && <Field label="VAT %"><input type="number" step="any" min={0} max={100} value={doc.data.vatRate} readOnly={!rw} onChange={(e) => setData({ vatRate: Number(e.target.value) || 0 })} /></Field>}
                </div>
                <div className="totals">
                  <div><span className="muted">Subtotal</span><span className="tabular">{formatMoney(totals.subtotal, doc.currency)}</span></div>
                  {cd.vatRegistered && <div><span className="muted">VAT {doc.data.vatRate}%</span><span className="tabular">{formatMoney(totals.vat, doc.currency)}</span></div>}
                  {totals.discount > 0 && <div><span className="muted">Discount</span><span className="tabular">-{formatMoney(totals.discount, doc.currency)}</span></div>}
                  <div className="grand"><span>Total</span><span className="tabular">{formatMoney(totals.total, doc.currency)}</span></div>
                  {doc.currency !== "NAD" && fxRate && <div className="dim" style={{ fontSize: 12 }}><span>≈ NAD at {fxRate}</span><span>{formatMoney(totals.total * fxRate, "NAD")}</span></div>}
                </div>
              </div>
            </section>

            <section className="card">
              <Field label="Internal notes (never printed)"><textarea rows={3} value={doc.data.notes} readOnly={!rw} onChange={(e) => setData({ notes: e.target.value })} /></Field>
            </section>
          </div>

          <aside className="stack">
            <section className="card stack">
              <Field label="Number" hint={isNew ? "Leave blank to use the next number automatically." : undefined}>
                <input className="mono" value={doc.number} readOnly={!rw} placeholder={isNew ? "Automatic" : ""} onChange={(e) => set({ number: e.target.value })} />
              </Field>
              <div className="grid2">
                <Field label="Date"><input type="date" value={doc.date} readOnly={!rw} onChange={(e) => set({ date: e.target.value })} /></Field>
                <Field label={type === "invoice" ? "Due date" : "Valid until"}><input type="date" value={doc.due_date} min={doc.date} readOnly={!rw} onChange={(e) => set({ due_date: e.target.value })} /></Field>
              </div>
              <div className="grid2">
                <Field label="Currency">
                  <select value={doc.currency} disabled={!rw} onChange={(e) => set({ currency: e.target.value as Currency, fx_rate: e.target.value === "NAD" ? null : doc.fx_rate ?? cd.usdToNad })}>
                    {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </Field>
                {doc.currency !== "NAD" && <Field label="NAD per 1 USD"><input type="number" step="any" min={0} value={fxRate ?? ""} readOnly={!rw} onChange={(e) => set({ fx_rate: Number(e.target.value) || null })} /></Field>}
              </div>
              {isNew && (
                <Field label="Status">
                  <select value={doc.status} onChange={(e) => set({ status: e.target.value })}>{statuses.filter((s) => s !== "invoiced").map((s) => <option key={s} value={s}>{s}</option>)}</select>
                </Field>
              )}
              <Field label="Project">
                <select value={doc.project_id ?? ""} disabled={!rw} onChange={(e) => set({ project_id: e.target.value || null })}>
                  <option value="">None</option>
                  {projects.filter((p) => !doc.client_id || !p.client_id || p.client_id === doc.client_id).map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
              </Field>
            </section>

            {!isNew && (
              <section className="card stack">
                <h2 style={{ margin: 0 }}>Actions</h2>
                {canWrite(me?.role) && (
                  <div className="row">
                    {type === "invoice" ? <>
                      {meta.status === "draft" && <button onClick={() => setStatus("sent")}>Mark sent</button>}
                      {["sent", "overdue"].includes(meta.status) && <button className="primary" onClick={() => setStatus("paid")}>Mark paid</button>}
                      {meta.status === "paid" && <button onClick={() => setStatus("sent")}>Undo paid</button>}
                      {!["cancelled", "paid"].includes(meta.status) && meta.status !== "draft" && <button className="danger" onClick={() => setStatus("cancelled")}>Cancel invoice</button>}
                    </> : <>
                      {meta.status === "draft" && <button onClick={() => setStatus("sent")}>Mark sent</button>}
                      {["draft", "sent"].includes(meta.status) && <><button onClick={() => setStatus("accepted")}>Accepted</button><button onClick={() => setStatus("declined")}>Declined</button></>}
                      {meta.status === "declined" && <button onClick={() => setStatus("sent")}>Reopen</button>}
                    </>}
                  </div>
                )}
                {canWrite(me?.role) && (
                  <div className="stack" style={{ gap: 6 }}>
                    {type === "quote" && !["invoiced", "declined"].includes(meta.status) && <button disabled={busy} onClick={() => action("convert", "Invoice created", (r) => `/crm/invoices/${r.id}`)}><FileOutput /> Convert to invoice</button>}
                    {type === "quote" && <button disabled={busy} onClick={() => action("project", meta.project_id ? "Opening project" : "Project created", () => "/crm/projects")}><FolderKanban /> {meta.project_id ? "Open project" : "Create project"}</button>}
                    <button disabled={busy} onClick={() => action("duplicate", "Copy created", (r) => `${base}/${r.id}`)}><Copy /> Duplicate</button>
                    {type === "invoice" && !doc.retainer_id && doc.client_id && <button disabled={busy} onClick={async () => {
                      try { await crmFetch(`/api/crm/retainers/from-document/${docId}`, { method: "POST", body: {} }); toast("Retainer created from this invoice"); router.push("/crm/retainers"); } catch (e) { toast(errText(e), "err"); }
                    }}><Repeat /> Make monthly retainer</button>}
                    {meta.status === "draft" && <button className="danger" onClick={remove}><Trash2 /> Delete draft</button>}
                  </div>
                )}
              </section>
            )}

            {!isNew && type === "quote" && doc.data.acceptance && ["accepted", "invoiced"].includes(meta.status) && (
              <section className="card" style={{ fontSize: 13, borderColor: "var(--ok)" }}>
                <h2 style={{ margin: "0 0 6px" }}>Accepted by the client</h2>
                <b>{doc.data.acceptance.name}</b> ({doc.data.acceptance.email})<br />
                {new Date(doc.data.acceptance.at).toLocaleString("en-NA", { timeZone: "Africa/Windhoek", dateStyle: "medium", timeStyle: "short" })} via the client portal{doc.data.acceptance.ip ? ` · IP ${doc.data.acceptance.ip}` : ""}
              </section>
            )}
            {!isNew && type === "invoice" && meta.status !== "draft" && doc.id && <NoticesPanel docId={doc.id} onRecorded={async () => {
              try { const d = await crmFetch<Loaded>(`/api/crm/documents/${docId}`); setDoc({ ...d }); setMeta((m) => ({ ...m, status: d.status })); setDirty(false); } catch (e) { toast(errText(e), "err"); }
            }} />}
            {!isNew && type === "invoice" && meta.status !== "draft" && doc.id && (
              <PaymentsPanel invoice={{ id: doc.id, number: doc.number, status: meta.status, currency: doc.currency, total: totals?.total ?? 0 }} onChange={async () => {
                try { const d = await crmFetch<Loaded>(`/api/crm/documents/${docId}`); setDoc({ ...d }); setMeta((m) => ({ ...m, status: d.status })); setDirty(false); } catch (e) { toast(errText(e), "err"); }
              }} />
            )}

            {!isNew && doc.id && <section className="card"><AttachmentsPanel entity="document" entityId={doc.id} /></section>}

            {!isNew && (meta.source || meta.derived.length > 0 || doc.retainer_id) && (
              <section className="card stack" style={{ fontSize: 13 }}>
                <h2 style={{ margin: 0 }}>Linked</h2>
                {meta.source && <div>From {meta.source.type} <Link className="mono" href={`/crm/${meta.source.type}s/${meta.source.id}`}>{meta.source.number}</Link></div>}
                {meta.derived.map((d) => <div key={d.id}>{d.type === "invoice" ? "Invoice" : "Quote"} <Link className="mono" href={`/crm/${d.type}s/${d.id}`}>{d.number}</Link> <StatusBadge s={d.status} /></div>)}
                {doc.retainer_id && <div>Generated by a <Link href="/crm/retainers">retainer</Link>{doc.period ? ` for ${doc.period}` : ""}</div>}
              </section>
            )}
          </aside>
        </div>
      )}
      {mailing && docId && <EmailDialog kind="document" docId={docId} onClose={() => setMailing(false)} onSent={(st) => { setMailing(false); if (st) setMeta((m) => ({ ...m, status: st as typeof m.status })); }} />}
    </>
  );
}
