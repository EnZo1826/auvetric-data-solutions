"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, FolderKanban, Plus, Trash2 } from "lucide-react";
import { crmFetch } from "./api";
import { canWrite, errText, useCrm } from "./store";
import { confirmAction, Empty, Field, Modal, Money, PageHead } from "./ui";
import { Timeline } from "./Clients";
import { TaskPanel } from "./Tasks";
import { formatDate, formatMoney, todayISO } from "@/crm/shared/calc";
import { CURRENCIES, PRACTICES, practiceLabel, type Activity, type Currency, type Practice } from "@/crm/shared/types";
import { LEAD_SOURCES, LEAD_STAGES, OPEN_STAGES, stageLabel, type Lead, type LeadSource, type LeadStage, type Task } from "@/crm/shared/sales";

const SOURCE_LABEL: Record<LeadSource, string> = { website: "Website", upwork: "Upwork", linkedin: "LinkedIn", referral: "Referral", direct: "Direct", other: "Other" };
const stageProb = (s: string) => LEAD_STAGES.find((x) => x.key === s)?.probability ?? 0;
const prob = (l: Lead) => l.probability ?? stageProb(l.stage);

/** Approximate NAD value for pipeline totals (USD at the company rate). */
function useNad() {
  const { company } = useCrm();
  const rate = Number(company?.data.usdToNad ?? 18.5);
  return (l: Pick<Lead, "value" | "currency">) => Number(l.value ?? 0) * (l.currency === "USD" ? rate : 1);
}

const blankLead = (stage: LeadStage, owner: string | null): Partial<Lead> => ({
  title: "", stage, client_id: null, contact_name: "", organisation: "", email: "", phone: "", value: null, currency: "NAD", probability: null,
  practice: null, source: "direct", owner_user_id: owner, next_follow_up: null, notes: "", lost_reason: "",
});

export function LeadsBoard() {
  const router = useRouter();
  const search = useSearchParams();
  const { me, toast, ensure } = useCrm();
  const nad = useNad();
  const [rows, setRows] = useState<Lead[] | null>(null);
  const [edit, setEdit] = useState<Partial<Lead> | null>(null);
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<{ col: string; index: number } | null>(null);
  const [q, setQ] = useState("");
  const [mine, setMine] = useState(false);
  const [closed, setClosed] = useState(true);
  const rw = canWrite(me?.role);

  useEffect(() => { ensure(["company", "clients", "users"]); }, [ensure]);
  const load = useCallback(() => crmFetch<Lead[]>("/api/crm/leads").then(setRows).catch((e) => toast(errText(e), "err")), [toast]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const o = search.get("open");
    if (o && rows) { const l = rows.find((r) => r.id === o); if (l) setEdit(l); router.replace("/crm/leads"); }
  }, [search, rows, router]);

  const filtered = useMemo(() => (rows ?? []).filter((l) => (!mine || l.owner_user_id === me?.id)
    && `${l.title} ${l.organisation} ${l.contact_name} ${l.client_name ?? ""}`.toLowerCase().includes(q.toLowerCase())), [rows, q, mine, me]);
  const cols = LEAD_STAGES.filter((s) => closed || OPEN_STAGES.includes(s.key));
  const inCol = (k: string) => filtered.filter((l) => l.stage === k).sort((a, b) => a.position - b.position);
  const open = filtered.filter((l) => OPEN_STAGES.includes(l.stage));
  const pipeline = open.reduce((s, l) => s + nad(l), 0);
  const weighted = open.reduce((s, l) => s + (nad(l) * prob(l)) / 100, 0);
  const today = todayISO();

  const move = async (lid: string, col: string, index: number) => {
    const all = rows ?? [];
    const l = all.find((x) => x.id === lid);
    if (!l) return;
    const target = all.filter((x) => x.stage === col && x.id !== lid).sort((a, b) => a.position - b.position);
    target.splice(index, 0, { ...l, stage: col as LeadStage });
    const ids = target.map((x) => x.id);
    setRows(all.map((x) => (x.id === lid ? { ...x, stage: col as LeadStage } : x)).map((x) => (ids.includes(x.id) ? { ...x, position: (ids.indexOf(x.id) + 1) * 1000 } : x)));
    try { await crmFetch("/api/crm/leads/move", { method: "POST", body: { id: lid, stage: col, ids } }); } catch (e) { toast(errText(e), "err"); load(); }
  };

  return (
    <>
      <PageHead title="Leads">
        {rw && <button className="primary" onClick={() => setEdit(blankLead("new", me?.id ?? null))}><Plus /> New lead</button>}
      </PageHead>
      <div className="filters">
        <input type="search" placeholder="Search leads, organisations, contacts…" value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="check"><input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} /> Owned by me</label>
        <label className="check"><input type="checkbox" checked={closed} onChange={(e) => setClosed(e.target.checked)} /> Show won / lost</label>
        <span className="dim" style={{ fontSize: 12, marginLeft: "auto" }}>
          Open pipeline <b className="tabular" style={{ color: "var(--text)" }}>{formatMoney(pipeline, "NAD")}</b> · weighted <b className="tabular" style={{ color: "var(--text)" }}>{formatMoney(weighted, "NAD")}</b>
        </span>
      </div>
      {rows === null ? <Empty>Loading…</Empty> : (
        <div className="board">
          {cols.map((col) => {
            const list = inCol(col.key);
            const total = list.reduce((s, l) => s + nad(l), 0);
            return (
              <div key={col.key} className={"col" + (over?.col === col.key ? " over" : "")}
                onDragOver={(e) => { if (drag) { e.preventDefault(); if (over?.col !== col.key) setOver({ col: col.key, index: list.length }); } }}
                onDrop={(e) => { e.preventDefault(); if (drag && over) move(drag, col.key, over.index); setDrag(null); setOver(null); }}>
                <div className="col-h"><i style={{ background: col.color }} />{col.label}
                  <span className="dim" style={{ marginLeft: "auto", fontWeight: 400, fontSize: 11 }}>{list.length}{total > 0 ? ` · ${formatMoney(total, "NAD").replace(/\.\d\d$/, "")}` : ""}</span>
                </div>
                <div className="col-b">
                  {list.map((l, i) => {
                    const late = l.next_follow_up && l.next_follow_up <= today && OPEN_STAGES.includes(l.stage);
                    return (
                      <div key={l.id}>
                        {over?.col === col.key && over.index === i && drag !== l.id && <div className="drop-marker" />}
                        <div className={"pcard" + (drag === l.id ? " dragging" : "")} style={{ ["--c" as string]: PRACTICES.find((p) => p.key === l.practice)?.color }} draggable={rw}
                          onDragStart={(e) => { setDrag(l.id); e.dataTransfer.effectAllowed = "move"; }}
                          onDragEnd={() => { setDrag(null); setOver(null); }}
                          onDragOver={(e) => { if (!drag) return; e.preventDefault(); e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); const idx = e.clientY < r.top + r.height / 2 ? i : i + 1; if (over?.col !== col.key || over.index !== idx) setOver({ col: col.key, index: idx }); }}
                          onClick={() => setEdit(l)} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && setEdit(l)}>
                          <div className="t">{l.title}</div>
                          <div className="m">
                            {(l.client_name || l.organisation) && <span>{l.client_name || l.organisation}</span>}
                            <span className="badge" style={{ fontSize: 10 }}>{SOURCE_LABEL[l.source]}</span>
                          </div>
                          <div className="m">
                            {l.value != null && <span className="tabular">{formatMoney(Number(l.value), l.currency)} · {prob(l)}%</span>}
                            {l.next_follow_up && OPEN_STAGES.includes(l.stage) && <span style={late ? { color: "var(--err)" } : undefined}>Follow up {formatDate(l.next_follow_up)}</span>}
                            {[l.owner_name?.split(" ")[0], l.open_tasks ? `${l.open_tasks} task${l.open_tasks > 1 ? "s" : ""}` : null].filter(Boolean).length > 0 &&
                              <span>{[l.owner_name?.split(" ")[0], l.open_tasks ? `${l.open_tasks} task${l.open_tasks > 1 ? "s" : ""}` : null].filter(Boolean).join(" · ")}</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {over?.col === col.key && over.index === list.length && <div className="drop-marker" />}
                  {!list.length && <div className="dim" style={{ fontSize: 12, textAlign: "center", padding: 16 }}>Empty</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {edit && <LeadModal initial={edit} onClose={() => setEdit(null)} onSaved={(keepOpen) => { if (!keepOpen) setEdit(null); load(); }} />}
    </>
  );
}

type Detail = { lead: Lead; activities: Activity[]; tasks: Task[]; enquiry: { id: string; name: string } | null; opportunity: { id: string; title: string; url: string; fit_score: number; source: string } | null; project: { id: string; title: string } | null };

function LeadModal({ initial, onClose, onSaved }: { initial: Partial<Lead>; onClose: () => void; onSaved: (keepOpen?: boolean) => void }) {
  const router = useRouter();
  const { me, toast, clients, users, reload } = useCrm();
  const [f, setF] = useState<Partial<Lead>>(initial);
  const [d, setD] = useState<Detail | null>(null);
  const [busy, setBusy] = useState(false);
  const rw = canWrite(me?.role);
  const set = (p: Partial<Lead>) => setF((x) => ({ ...x, ...p }));
  const loadDetail = useCallback(async () => {
    if (!initial.id) return;
    try { const x = await crmFetch<Detail>(`/api/crm/leads/${initial.id}`); setD(x); setF(x.lead); } catch (e) { toast(errText(e), "err"); }
  }, [initial.id, toast]);
  useEffect(() => { loadDetail(); }, [loadDetail]);

  const save = async () => {
    setBusy(true);
    try {
      const l = await crmFetch<Lead>(f.id ? `/api/crm/leads/${f.id}` : "/api/crm/leads", { method: f.id ? "PUT" : "POST", body: f });
      toast(f.id ? "Lead saved" : "Lead created");
      onSaved();
      if (!f.id) router.replace(`/crm/leads?open=${l.id}`); // reopens with tasks and timeline
    } catch (e) { toast(errText(e), "err"); } finally { setBusy(false); }
  };
  const action = async (path: string, ok: string, go?: (r: { id: string }) => string) => {
    setBusy(true);
    try {
      const r = await crmFetch<{ id: string }>(`/api/crm/leads/${f.id}/${path}`, { method: "POST" });
      toast(ok);
      if (path === "client") await reload("clients");
      await loadDetail();
      onSaved(true);
      if (go) router.push(go(r));
    } catch (e) { toast(errText(e), "err"); } finally { setBusy(false); }
  };
  const del = async () => {
    if (!f.id || !confirmAction("Delete this lead with its tasks and timeline? Linked enquiries and listings stay.")) return;
    try { await crmFetch(`/api/crm/leads/${f.id}`, { method: "DELETE" }); toast("Lead deleted"); onSaved(); } catch (e) { toast(errText(e), "err"); }
  };
  const won = f.stage === "won";

  return (
    <Modal wide title={f.id ? f.title || "Lead" : "New lead"} onClose={onClose} footer={<>
      {f.id && me?.role !== "readonly" && <button className="danger" onClick={del} style={{ marginRight: "auto" }}><Trash2 /> Delete</button>}
      <button onClick={onClose}>Close</button>
      {rw && <button className="primary" disabled={busy || !f.title?.trim()} onClick={save}>{busy ? "Saving…" : "Save"}</button>}
    </>}>
      <div className={f.id ? "split" : ""}>
        <div className="stack">
          <Field label="Title"><input autoFocus={!f.id} value={f.title ?? ""} readOnly={!rw} onChange={(e) => set({ title: e.target.value })} placeholder="e.g. Fleet telemetry dashboard for ACME Mining" /></Field>
          <div className="grid3">
            <Field label="Stage">
              <select value={f.stage} disabled={!rw} onChange={(e) => set({ stage: e.target.value as LeadStage })}>{LEAD_STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select>
            </Field>
            <Field label="Source">
              <select value={f.source} disabled={!rw} onChange={(e) => set({ source: e.target.value as LeadSource })}>{LEAD_SOURCES.map((s) => <option key={s} value={s}>{SOURCE_LABEL[s]}</option>)}</select>
            </Field>
            <Field label="Owner">
              <select value={f.owner_user_id ?? ""} disabled={!rw} onChange={(e) => set({ owner_user_id: e.target.value || null })}>
                <option value="">—</option>{users.filter((u) => !u.disabled).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </Field>
          </div>
          <div className="grid4">
            <Field label="Value"><input type="number" step="any" min={0} value={f.value ?? ""} readOnly={!rw} onChange={(e) => set({ value: e.target.value === "" ? null : Number(e.target.value) })} /></Field>
            <Field label="Currency"><select value={f.currency} disabled={!rw} onChange={(e) => set({ currency: e.target.value as Currency })}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
            <Field label="Probability %" hint={`Blank = stage default (${stageProb(f.stage ?? "new")}%)`}><input type="number" min={0} max={100} value={f.probability ?? ""} readOnly={!rw} onChange={(e) => set({ probability: e.target.value === "" ? null : Number(e.target.value) })} /></Field>
            <Field label="Next follow-up"><input type="date" value={f.next_follow_up ?? ""} readOnly={!rw} onChange={(e) => set({ next_follow_up: e.target.value || null })} /></Field>
          </div>
          <div className="grid2">
            <Field label="Practice">
              <select value={f.practice ?? ""} disabled={!rw} onChange={(e) => set({ practice: (e.target.value || null) as Practice | null })}>
                <option value="">—</option>{PRACTICES.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
              </select>
            </Field>
            <Field label="Client (if existing)">
              <select value={f.client_id ?? ""} disabled={!rw} onChange={(e) => set({ client_id: e.target.value || null })}>
                <option value="">— not a client yet —</option>{clients.filter((c) => !c.archived || c.id === f.client_id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
          </div>
          <div className="grid4">
            <Field label="Organisation"><input value={f.organisation ?? ""} readOnly={!rw} onChange={(e) => set({ organisation: e.target.value })} /></Field>
            <Field label="Contact"><input value={f.contact_name ?? ""} readOnly={!rw} onChange={(e) => set({ contact_name: e.target.value })} /></Field>
            <Field label="Email"><input type="email" value={f.email ?? ""} readOnly={!rw} onChange={(e) => set({ email: e.target.value })} /></Field>
            <Field label="Phone"><input value={f.phone ?? ""} readOnly={!rw} onChange={(e) => set({ phone: e.target.value })} /></Field>
          </div>
          <Field label="Notes"><textarea rows={5} value={f.notes ?? ""} readOnly={!rw} onChange={(e) => set({ notes: e.target.value })} /></Field>
          {f.stage === "lost" && <Field label="Why was it lost?"><input value={f.lost_reason ?? ""} readOnly={!rw} onChange={(e) => set({ lost_reason: e.target.value })} placeholder="e.g. price, timing, chose another vendor" /></Field>}
          {f.id && d && (
            <section className="stack" style={{ gap: 6 }}>
              <h2 style={{ margin: "8px 0 0" }}>Activity</h2>
              <Timeline entity="lead" entityId={f.id} items={d.activities} onChange={loadDetail} />
            </section>
          )}
        </div>
        {f.id && (
          <div className="stack">
            <section className="card">
              <dl className="kv">
                <dt>Stage</dt><dd>{stageLabel(f.stage ?? "new")}{f.closed_at ? <span className="dim"> · {formatDate(String(f.closed_at).slice(0, 10))}</span> : null}</dd>
                <dt>Value</dt><dd>{f.value != null ? <Money v={Number(f.value)} c={f.currency ?? "NAD"} /> : "—"}</dd>
                <dt>Practice</dt><dd>{practiceLabel(f.practice)}</dd>
                {d?.enquiry && <><dt>Enquiry</dt><dd><Link href={`/crm/enquiries?open=${d.enquiry.id}`}>{d.enquiry.name}</Link></dd></>}
                {d?.opportunity && <><dt>Listing</dt><dd><Link href={`/crm/opportunities?open=${d.opportunity.id}`}>{d.opportunity.title}</Link> <span className="dim">({d.opportunity.fit_score})</span></dd></>}
                <dt>Client</dt><dd>{f.client_id ? <Link href={`/crm/clients/${f.client_id}`}>{clients.find((c) => c.id === f.client_id)?.name ?? "open"}</Link>
                  : rw ? <button className="sm" disabled={busy} onClick={() => action("client", "Client created")}><Building2 /> Create client</button> : "—"}</dd>
                <dt>Project</dt><dd>{d?.project ? <Link href={`/crm/projects?open=${d.project.id}`}>{d.project.title}</Link>
                  : rw ? <button className={"sm" + (won ? " primary" : "")} disabled={busy} onClick={() => action("project", "Project created", (r) => `/crm/projects?open=${r.id}`)}><FolderKanban /> Start project</button> : "—"}</dd>
              </dl>
              {rw && f.client_id && <div className="row" style={{ gap: 6, marginTop: 10 }}><Link className="btn sm" href={`/crm/quotes/new?client_id=${f.client_id}`}>New quote</Link></div>}
            </section>
            <section className="card stack" style={{ gap: 6 }}>
              <h2 style={{ margin: 0 }}>Tasks</h2>
              <TaskPanel entity="lead" entityId={f.id} onChange={() => onSaved(true)} />
            </section>
          </div>
        )}
      </div>
    </Modal>
  );
}
