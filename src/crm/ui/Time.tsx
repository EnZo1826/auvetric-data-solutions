"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FileOutput, Pencil, Plus, Trash2 } from "lucide-react";
import { crmFetch } from "./api";
import { canWrite, errText, useCrm } from "./store";
import { confirmAction, Empty, Field, Modal, PageHead } from "./ui";
import { addDays, formatDate, formatMoney, todayISO } from "@/crm/shared/calc";
import { CURRENCIES, type Currency, type Project } from "@/crm/shared/types";

type Entry = { id: string; user_id: string; user_name: string; project_id: string | null; project_title: string | null; client_id: string | null; client_name: string | null;
  date: string; minutes: number; description: string; billable: boolean; rate: number | null; currency: Currency; invoice_id: string | null; invoice_number: string | null };
type ProjectRow = Project & { client_name: string | null };

/** "1.5", "1,5", "1:30", "90m", "2h" → minutes. */
export function parseDuration(v: string): number | null {
  const s = v.trim().toLowerCase().replace(",", ".");
  if (!s) return null;
  let m: RegExpMatchArray | null;
  if ((m = s.match(/^(\d{1,2}):([0-5]\d)$/))) return Number(m[1]) * 60 + Number(m[2]);
  if ((m = s.match(/^(\d+(?:\.\d+)?)\s*m(in)?$/))) return Math.round(Number(m[1]));
  if ((m = s.match(/^(\d+(?:\.\d+)?)\s*h?$/))) return Math.round(Number(m[1]) * 60);
  return null;
}
export const fmtHours = (min: number) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")}`;

function weekStart(iso: string) {
  const d = new Date(iso + "T00:00:00Z");
  return addDays(iso, -((d.getUTCDay() + 6) % 7)); // Monday
}
const RANGES = {
  this_week: () => [weekStart(todayISO()), addDays(weekStart(todayISO()), 6)],
  last_week: () => [addDays(weekStart(todayISO()), -7), addDays(weekStart(todayISO()), -1)],
  this_month: () => [todayISO().slice(0, 8) + "01", todayISO()],
  last_month: () => { const first = todayISO().slice(0, 8) + "01"; const prevEnd = addDays(first, -1); return [prevEnd.slice(0, 8) + "01", prevEnd]; },
  all: () => ["", ""],
} as const;
const RATE_KEY = "auv-crm-time-rate";

export function TimeScreen() {
  const router = useRouter();
  const { me, users, clients, ensure, toast } = useCrm();
  const [range, setRange] = useState<keyof typeof RANGES>("this_week");
  const [who, setWho] = useState("me");
  const [status, setStatus] = useState("");
  const [rows, setRows] = useState<Entry[] | null>(null);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [edit, setEdit] = useState<Partial<Entry> | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [invoicing, setInvoicing] = useState(false);
  const rw = canWrite(me?.role);

  useEffect(() => { ensure(["users", "clients"]); crmFetch<ProjectRow[]>("/api/crm/projects").then(setProjects).catch(() => {}); }, [ensure]);
  const load = useCallback(() => {
    const [from, to] = RANGES[range]();
    const qs = new URLSearchParams();
    if (from) qs.set("from", from); if (to) qs.set("to", to); if (who) qs.set("user", who); if (status) qs.set("status", status);
    return crmFetch<Entry[]>(`/api/crm/time?${qs}`).then((r) => { setRows(r); setSel(new Set()); }).catch((e) => toast(errText(e), "err"));
  }, [range, who, status, toast]);
  useEffect(() => { load(); }, [load]);

  const sum = useMemo(() => {
    const r = rows ?? [];
    const unbilled: Record<string, number> = {};
    for (const t of r) if (t.billable && !t.invoice_id) unbilled[t.currency] = (unbilled[t.currency] ?? 0) + (t.minutes / 60) * Number(t.rate);
    return { total: r.reduce((s, t) => s + t.minutes, 0), billable: r.filter((t) => t.billable).reduce((s, t) => s + t.minutes, 0), unbilled };
  }, [rows]);
  const selectable = (t: Entry) => t.billable && !t.invoice_id;
  const selRows = (rows ?? []).filter((t) => sel.has(t.id));
  const del = async (t: Entry) => {
    if (!confirmAction("Delete this time entry?")) return;
    try { await crmFetch(`/api/crm/time/${t.id}`, { method: "DELETE" }); load(); } catch (e) { toast(errText(e), "err"); }
  };

  return (
    <>
      <PageHead title="Time">{rw && <button className="primary" onClick={() => setEdit({ date: todayISO(), billable: true })}><Plus /> Log time</button>}</PageHead>
      <div className="filters">
        <select value={range} onChange={(e) => setRange(e.target.value as keyof typeof RANGES)} aria-label="Period">
          <option value="this_week">This week</option><option value="last_week">Last week</option><option value="this_month">This month</option><option value="last_month">Last month</option><option value="all">All time</option>
        </select>
        <select value={who} onChange={(e) => setWho(e.target.value)} aria-label="Person">
          <option value="me">My time</option><option value="">Everyone</option>
          {users.filter((u) => u.id !== me?.id).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Billing status">
          <option value="">All entries</option><option value="unbilled">Billable, not invoiced</option><option value="billed">Invoiced</option><option value="nonbillable">Non-billable</option>
        </select>
        <span className="dim" style={{ fontSize: 12, marginLeft: "auto" }}>
          Total <b className="tabular" style={{ color: "var(--text)" }}>{fmtHours(sum.total)}</b> · billable <b className="tabular" style={{ color: "var(--text)" }}>{fmtHours(sum.billable)}</b>
          {Object.entries(sum.unbilled).map(([c, v]) => <span key={c}> · unbilled <b style={{ color: "var(--warn)" }}>{formatMoney(v, c)}</b></span>)}
        </span>
      </div>
      {rw && sel.size > 0 && (
        <div className="row" style={{ gap: 8, marginBottom: 10 }}>
          <span className="dim" style={{ fontSize: 12 }}>{sel.size} selected · {fmtHours(selRows.reduce((s, t) => s + t.minutes, 0))}</span>
          <button className="sm primary" onClick={() => setInvoicing(true)}><FileOutput /> Invoice selected</button>
          <button className="sm ghost" onClick={() => setSel(new Set())}>Clear</button>
        </div>
      )}
      <div className="card flush">
        {rows === null ? <Empty>Loading…</Empty> : !rows.length ? <Empty>No time logged in this period.</Empty> : (
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th style={{ width: 28 }} /><th>Date</th><th>Who</th><th>Project / client</th><th>Work</th><th className="r">Hours</th><th className="r">Value</th><th>Billing</th><th /></tr></thead>
            <tbody>{rows.map((t) => (
              <tr key={t.id}>
                <td>{rw && selectable(t) && <input type="checkbox" checked={sel.has(t.id)} aria-label="Select for invoicing"
                  onChange={() => setSel((s) => { const n = new Set(s); if (n.has(t.id)) n.delete(t.id); else n.add(t.id); return n; })} />}</td>
                <td className="nowrap">{formatDate(t.date)}</td>
                <td className="muted">{t.user_name.split(" ")[0]}</td>
                <td>{t.project_title ?? <span className="dim">No project</span>}{t.client_name && <div className="dim" style={{ fontSize: 12 }}>{t.client_name}</div>}</td>
                <td style={{ maxWidth: 380, fontSize: 13 }} className="pre">{t.description || <span className="dim">—</span>}</td>
                <td className="r tabular">{fmtHours(t.minutes)}</td>
                <td className="r tabular">{t.billable && t.rate ? formatMoney((t.minutes / 60) * Number(t.rate), t.currency) : <span className="dim">—</span>}</td>
                <td>{!t.billable ? <span className="badge">non-billable</span> : t.invoice_id ? <Link className="mono" href={`/crm/invoices/${t.invoice_id}`}>{t.invoice_number}</Link> : <span className="badge warn">unbilled</span>}</td>
                <td className="r nowrap">{rw && !t.invoice_id && (t.user_id === me?.id || me?.role === "admin") && <>
                  <button className="ghost icon sm" aria-label="Edit" onClick={() => setEdit(t)}><Pencil /></button>
                  <button className="ghost icon sm" aria-label="Delete" onClick={() => del(t)}><Trash2 /></button>
                </>}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </div>
      {edit && <TimeModal initial={edit} projects={projects} clients={clients} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />}
      {invoicing && <InvoiceTimeModal rows={selRows} onClose={() => setInvoicing(false)} onDone={(id) => { setInvoicing(false); router.push(`/crm/invoices/${id}`); }} />}
    </>
  );
}

function TimeModal({ initial, projects, clients, onClose, onSaved }: { initial: Partial<Entry>; projects: ProjectRow[]; clients: ReturnType<typeof useCrm.getState>["clients"]; onClose: () => void; onSaved: () => void }) {
  const { toast } = useCrm();
  const saved = (() => { try { return JSON.parse(localStorage.getItem(RATE_KEY) ?? "null") as { rate: number; currency: Currency } | null; } catch { return null; } })();
  const [f, setF] = useState({
    date: initial.date ?? todayISO(), project_id: initial.project_id ?? "", client_id: initial.client_id ?? "", duration: initial.minutes ? fmtHours(initial.minutes) : "",
    description: initial.description ?? "", billable: initial.billable ?? true, rate: String(initial.rate ?? saved?.rate ?? ""), currency: (initial.currency ?? saved?.currency ?? "NAD") as Currency,
  });
  const [busy, setBusy] = useState(false);
  const minutes = parseDuration(f.duration);
  const project = projects.find((p) => p.id === f.project_id);
  const save = async () => {
    if (!minutes) { toast("Enter the time as 1.5, 1:30 or 90m.", "err"); return; }
    setBusy(true);
    try {
      const body = { date: f.date, project_id: f.project_id || null, client_id: f.project_id ? project?.client_id ?? null : f.client_id || null, minutes, description: f.description,
        billable: f.billable, rate: f.billable ? Number(f.rate) || null : null, currency: f.currency };
      await crmFetch(initial.id ? `/api/crm/time/${initial.id}` : "/api/crm/time", { method: initial.id ? "PUT" : "POST", body });
      if (f.billable && Number(f.rate) > 0) try { localStorage.setItem(RATE_KEY, JSON.stringify({ rate: Number(f.rate), currency: f.currency })); } catch { /* private mode */ }
      toast(initial.id ? "Time updated" : `${fmtHours(minutes)} logged`);
      onSaved();
    } catch (e) { toast(errText(e), "err"); } finally { setBusy(false); }
  };
  return (
    <Modal title={initial.id ? "Edit time" : "Log time"} onClose={onClose} footer={<><button onClick={onClose}>Cancel</button><button className="primary" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save"}</button></>}>
      <div className="stack">
        <div className="grid3">
          <Field label="Date"><input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
          <Field label="Time spent" hint={minutes ? `${fmtHours(minutes)} h` : "1.5 · 1:30 · 90m"}><input autoFocus value={f.duration} onChange={(e) => setF({ ...f, duration: e.target.value })} placeholder="1:30" /></Field>
          <Field label="Project">
            <select value={f.project_id} onChange={(e) => setF({ ...f, project_id: e.target.value })}>
              <option value="">— none —</option>{projects.filter((p) => p.status !== "done" || p.id === f.project_id).map((p) => <option key={p.id} value={p.id}>{p.title}{p.client_name ? ` · ${p.client_name}` : ""}</option>)}
            </select>
          </Field>
        </div>
        {!f.project_id && (
          <Field label="Client (when there is no project)">
            <select value={f.client_id} onChange={(e) => setF({ ...f, client_id: e.target.value })}><option value="">— none —</option>{clients.filter((c) => !c.archived).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          </Field>
        )}
        <Field label="What was done" hint="Shown on the invoice line."><textarea rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <div className="grid3" style={{ alignItems: "end" }}>
          <label className="check"><input type="checkbox" checked={f.billable} onChange={(e) => setF({ ...f, billable: e.target.checked })} /> Billable</label>
          {f.billable && <Field label="Hourly rate"><input type="number" step="0.01" min={0} value={f.rate} onChange={(e) => setF({ ...f, rate: e.target.value })} /></Field>}
          {f.billable && <Field label="Currency"><select value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value as Currency })}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></Field>}
        </div>
      </div>
    </Modal>
  );
}

/** Shared by time and expense re-billing: new draft invoice, or append to an existing draft of the client. */
export function InvoiceTargetPicker({ clientId, value, onChange }: { clientId: string | null; value: string; onChange: (v: string) => void }) {
  const [drafts, setDrafts] = useState<{ id: string; number: string; currency: Currency; date: string }[]>([]);
  useEffect(() => { if (clientId) crmFetch<typeof drafts>(`/api/crm/clients/${clientId}/draft-invoices`).then(setDrafts).catch(() => setDrafts([])); }, [clientId]);
  return (
    <Field label="Invoice">
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">New draft invoice</option>
        {drafts.map((d) => <option key={d.id} value={d.id}>Add to draft {d.number} ({d.currency}, {formatDate(d.date)})</option>)}
      </select>
    </Field>
  );
}

function InvoiceTimeModal({ rows, onClose, onDone }: { rows: Entry[]; onClose: () => void; onDone: (invoiceId: string) => void }) {
  const { toast } = useCrm();
  const [group, setGroup] = useState<"project" | "entry">("project");
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const clientsSel = [...new Set(rows.map((r) => r.client_id))];
  const curs = [...new Set(rows.map((r) => r.currency))];
  const problem = clientsSel.length !== 1 ? "Select time for one client at a time." : curs.length !== 1 ? "Select time in one currency at a time." : null;
  const go = async () => {
    setBusy(true);
    try { const inv = await crmFetch<{ id: string; number: string }>("/api/crm/time/invoice", { method: "POST", body: { ids: rows.map((r) => r.id), group, invoice_id: target || null } }); toast(`Added to ${inv.number}`); onDone(inv.id); }
    catch (e) { toast(errText(e), "err"); } finally { setBusy(false); }
  };
  return (
    <Modal title="Invoice selected time" onClose={onClose} footer={<><button onClick={onClose}>Cancel</button><button className="primary" disabled={busy || !!problem} onClick={go}>{busy ? "Working…" : "Create invoice lines"}</button></>}>
      <div className="stack">
        {problem ? <div className="warn-box">{problem}</div> : <>
          <div style={{ fontSize: 13 }}>{rows.length} entr{rows.length === 1 ? "y" : "ies"} · {fmtHours(rows.reduce((s, r) => s + r.minutes, 0))} h for <b>{rows[0].client_name}</b> in {curs[0]}.</div>
          <Field label="Lines">
            <select value={group} onChange={(e) => setGroup(e.target.value as "project" | "entry")}>
              <option value="project">One line per project and rate (work summarised in the description)</option>
              <option value="entry">One line per time entry</option>
            </select>
          </Field>
          <InvoiceTargetPicker clientId={clientsSel[0]} value={target} onChange={setTarget} />
          <p className="dim" style={{ margin: 0, fontSize: 12 }}>Removing a line from the draft later releases its time so it can be invoiced again.</p>
        </>}
      </div>
    </Modal>
  );
}
