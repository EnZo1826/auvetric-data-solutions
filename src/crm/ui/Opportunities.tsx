"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, KanbanSquare } from "lucide-react";
import { crmFetch } from "./api";
import { canWrite, errText, useCrm } from "./store";
import { Empty, Modal, PageHead, StatusBadge, Tabs } from "./ui";
import { Timeline } from "./Clients";
import { TaskPanel } from "./Tasks";
import { PRACTICES, practiceLabel, type Activity } from "@/crm/shared/types";
import { OPP_STATUSES, type Opportunity, type OppStatus } from "@/crm/shared/sales";

const when = (iso: string) => new Intl.DateTimeFormat("en-NA", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Windhoek" }).format(new Date(iso));
export const fitColor = (n: number) => (n >= 75 ? "var(--ok)" : n >= 50 ? "var(--warn)" : "var(--dim)");
const OPP_TONE: Record<string, string> = { new: "", shortlisted: "info", applied: "violet", interviewing: "warn", won: "ok", lost: "err", skipped: "mute" };

export function FitScore({ n }: { n: number }) {
  return <span className="tabular" style={{ fontWeight: 700, color: fitColor(n) }} title="Fit score from n8n (0–100)">{n}</span>;
}

export function OpportunitiesScreen() {
  const router = useRouter();
  const search = useSearchParams();
  const { me, toast } = useCrm();
  const [status, setStatus] = useState("open");
  const [minFit, setMinFit] = useState(0);
  const [source, setSource] = useState("");
  const [days, setDays] = useState(30);
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Opportunity[] | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<string | null>(null);
  const rw = canWrite(me?.role);

  const load = useCallback(() => {
    const qs = new URLSearchParams({ status, min_fit: String(minFit), days: String(days) });
    if (source) qs.set("source", source);
    if (q.trim()) qs.set("q", q.trim());
    return crmFetch<Opportunity[]>(`/api/crm/opportunities?${qs}`).then((r) => { setRows(r); setSel(new Set()); }).catch((e) => toast(errText(e), "err"));
  }, [status, minFit, source, days, q, toast]);
  useEffect(() => { const t = setTimeout(load, q ? 250 : 0); return () => clearTimeout(t); }, [load, q]);
  useEffect(() => { const o = search.get("open"); if (o && /^\d+$/.test(o)) { setOpen(o); router.replace("/crm/opportunities"); } }, [search, router]);

  const setStatusOf = async (o: Opportunity, s: OppStatus) => {
    setRows((r) => r?.map((x) => (x.id === o.id ? { ...x, status: s } : x)) ?? null);
    try { await crmFetch(`/api/crm/opportunities/${o.id}`, { method: "PATCH", body: { status: s } }); } catch (e) { toast(errText(e), "err"); load(); }
  };
  const bulk = async (s: OppStatus) => {
    try { const r = await crmFetch<{ updated: number }>("/api/crm/opportunities/bulk-status", { method: "POST", body: { ids: [...sel], status: s } }); toast(`${r.updated} updated`); load(); } catch (e) { toast(errText(e), "err"); }
  };
  const sources = useMemo(() => [...new Set((rows ?? []).map((r) => r.source))].sort(), [rows]);
  const allSel = !!rows?.length && rows.every((r) => sel.has(r.id));

  return (
    <>
      <PageHead title="Opportunities" />
      <div className="filters">
        <Tabs value={status} onChange={setStatus} tabs={[{ key: "open", label: "Open" }, { key: "new", label: "New" }, { key: "shortlisted", label: "Shortlisted" }, { key: "applied", label: "Applied" }, { key: "", label: "All" }]} />
        <input type="search" placeholder="Search title, company, skills…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={minFit} onChange={(e) => setMinFit(Number(e.target.value))} aria-label="Minimum fit">
          <option value={0}>Any fit</option><option value={50}>Fit ≥ 50</option><option value={70}>Fit ≥ 70</option><option value={80}>Fit ≥ 80</option>
        </select>
        <select value={source} onChange={(e) => setSource(e.target.value)} aria-label="Source">
          <option value="">All sources</option>
          {[...new Set(["upwork", "linkedin", ...sources])].map((s) => <option key={s} value={s} style={{ textTransform: "capitalize" }}>{s}</option>)}
        </select>
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Period">
          <option value={1}>Last 24 hours</option><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option><option value={0}>Any time</option>
        </select>
      </div>
      {rw && sel.size > 0 && (
        <div className="row" style={{ gap: 6, marginBottom: 10 }}>
          <span className="dim" style={{ fontSize: 12 }}>{sel.size} selected</span>
          <button className="sm" onClick={() => bulk("shortlisted")}>Shortlist</button>
          <button className="sm" onClick={() => bulk("skipped")}>Skip</button>
          <button className="sm ghost" onClick={() => setSel(new Set())}>Clear</button>
        </div>
      )}
      <div className="card flush">
        {rows === null ? <Empty>Loading…</Empty> : !rows.length ? <Empty>No listings match. n8n adds Upwork and LinkedIn alert jobs here every few minutes while the partners&apos; PC is on.</Empty> : (
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr>
              {rw && <th style={{ width: 28 }}><input type="checkbox" checked={allSel} onChange={() => setSel(allSel ? new Set() : new Set(rows.map((r) => r.id)))} aria-label="Select all" /></th>}
              <th className="r">Fit</th><th>Listing</th><th>Practice</th><th>Budget</th><th>Received</th><th>Status</th>
            </tr></thead>
            <tbody>{rows.map((o) => (
              <tr key={o.id}>
                {rw && <td><input type="checkbox" checked={sel.has(o.id)} onChange={() => setSel((s) => { const n = new Set(s); if (n.has(o.id)) n.delete(o.id); else n.add(o.id); return n; })} aria-label={`Select ${o.title}`} /></td>}
                <td className="r"><FitScore n={o.fit_score} /></td>
                <td className="click" onClick={() => setOpen(o.id)} style={{ maxWidth: 460 }}>
                  <b style={{ fontWeight: 600 }}>{o.title}</b>
                  <div className="dim" style={{ fontSize: 12 }}><span style={{ textTransform: "capitalize" }}>{o.source}</span>{o.company ? ` · ${o.company}` : ""}{o.employment_type !== "unknown" ? ` · ${o.employment_type.replace(/_/g, " ")}` : ""}</div>
                  {o.summary && <div className="muted" style={{ fontSize: 12 }}>{o.summary.slice(0, 160)}{o.summary.length > 160 ? "…" : ""}</div>}
                </td>
                <td className="nowrap" style={{ fontSize: 12 }}>{o.practice ? <><i className="practice-dot" style={{ background: PRACTICES.find((p) => p.key === o.practice)?.color }} />{practiceLabel(o.practice).split(" ")[0]}</> : <span className="dim">—</span>}</td>
                <td className="muted" style={{ fontSize: 12, maxWidth: 160 }}>{o.budget || "—"}</td>
                <td className="nowrap muted" style={{ fontSize: 12 }}>{when(o.received_at)}</td>
                <td>
                  {rw ? <select value={o.status} onChange={(e) => setStatusOf(o, e.target.value as OppStatus)} aria-label="Status" style={{ minWidth: 0, width: "auto", padding: "3px 6px" }}>
                    {OPP_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select> : <StatusBadge s={o.status} />}
                </td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </div>
      {open && <OpportunityModal id={open} onClose={() => setOpen(null)} onChanged={load} />}
    </>
  );
}

type Detail = { opportunity: Opportunity & { lead_title: string | null }; activities: Activity[] };

function OpportunityModal({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const router = useRouter();
  const { me, toast } = useCrm();
  const [d, setD] = useState<Detail | null>(null);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const rw = canWrite(me?.role);
  const load = useCallback(() => crmFetch<Detail>(`/api/crm/opportunities/${id}`).then((x) => { setD(x); setNotes(x.opportunity.notes); }).catch((e) => { toast(errText(e), "err"); onClose(); }), [id, toast, onClose]);
  useEffect(() => { load(); }, [load]);
  if (!d) return <Modal title="Opportunity" onClose={onClose}><Empty>Loading…</Empty></Modal>;
  const o = d.opportunity;
  const patch = async (body: Record<string, unknown>, ok: string) => {
    setBusy(true);
    try { await crmFetch(`/api/crm/opportunities/${id}`, { method: "PATCH", body }); toast(ok); await load(); onChanged(); } catch (e) { toast(errText(e), "err"); } finally { setBusy(false); }
  };
  const toLead = async () => {
    setBusy(true);
    try { const l = await crmFetch<{ id: string }>(`/api/crm/opportunities/${id}/lead`, { method: "POST" }); onChanged(); router.push(`/crm/leads?open=${l.id}`); } catch (e) { toast(errText(e), "err"); } finally { setBusy(false); }
  };

  return (
    <Modal wide title={o.title} onClose={onClose} footer={<>
      {o.url && <a className="btn" href={o.url} target="_blank" rel="noopener noreferrer" style={{ marginRight: "auto" }}><ExternalLink /> Open listing</a>}
      {rw && o.status !== "skipped" && <button disabled={busy} onClick={() => patch({ status: "skipped" }, "Skipped")}>Skip</button>}
      {rw && o.status === "new" && <button disabled={busy} onClick={() => patch({ status: "shortlisted" }, "Shortlisted")}>Shortlist</button>}
      {rw && (o.lead_id ? <Link className="btn primary" href={`/crm/leads?open=${o.lead_id}`}><KanbanSquare /> Open lead</Link>
        : <button className="primary" disabled={busy} onClick={toLead}><KanbanSquare /> Add to pipeline</button>)}
    </>}>
      <div className="split">
        <div className="stack">
          <section className="card stack" style={{ gap: 8 }}>
            <div className="row" style={{ gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
              <span style={{ fontSize: 28 }}><FitScore n={o.fit_score} /></span><span className="dim">/ 100 fit</span>
              <span className={"badge " + (o.action === "apply_now" ? "ok" : o.action === "skip" ? "mute" : "info")}>{o.action.replace(/_/g, " ")}</span>
              {o.extraction_status !== "ok" && <span className="badge err" title={o.extraction_status}>extraction failed</span>}
            </div>
            {o.summary && <p style={{ margin: 0 }} className="pre">{o.summary}</p>}
            {o.reasons && <div><div className="dim" style={{ fontSize: 11, textTransform: "uppercase" }}>Why it fits</div><div className="pre" style={{ fontSize: 13 }}>{o.reasons}</div></div>}
            {o.red_flags && <div><div className="dim" style={{ fontSize: 11, textTransform: "uppercase" }}>Red flags</div><div className="pre" style={{ fontSize: 13, color: "var(--warn)" }}>{o.red_flags}</div></div>}
          </section>
          <section className="card stack" style={{ gap: 6 }}>
            <h2 style={{ margin: 0 }}>Activity</h2>
            <Timeline entity="opportunity" entityId={o.id} items={d.activities} onChange={load} />
          </section>
        </div>
        <div className="stack">
          <section className="card">
            <dl className="kv">
              <dt>Source</dt><dd style={{ textTransform: "capitalize" }}>{o.source}</dd>
              <dt>Company</dt><dd>{o.company || "—"}</dd>
              <dt>Location</dt><dd>{o.location || "—"} {o.remote !== "unknown" && <span className="dim">({o.remote})</span>}</dd>
              <dt>Type</dt><dd>{o.employment_type.replace(/_/g, " ")}</dd>
              <dt>Budget</dt><dd>{o.budget || "—"}</dd>
              <dt>Level</dt><dd>{o.experience_level || "—"}</dd>
              <dt>Practice</dt><dd>{practiceLabel(o.practice)}</dd>
              <dt>Skills</dt><dd style={{ fontSize: 12 }}>{o.skills || "—"}</dd>
              <dt>Received</dt><dd>{when(o.received_at)}</dd>
              <dt>Status</dt><dd><span className={"badge " + (OPP_TONE[o.status] ?? "")}>{o.status}</span></dd>
              <dt>Lead</dt><dd>{o.lead_id ? <Link href={`/crm/leads?open=${o.lead_id}`}>{o.lead_title}</Link> : "—"}</dd>
            </dl>
          </section>
          <section className="card stack" style={{ gap: 6 }}>
            <h2 style={{ margin: 0 }}>Tasks</h2>
            <TaskPanel entity="opportunity" entityId={o.id} />
          </section>
          <section className="card stack" style={{ gap: 6 }}>
            <h2 style={{ margin: 0 }}>Proposal notes</h2>
            <textarea rows={5} value={notes} readOnly={!rw} onChange={(e) => setNotes(e.target.value)} placeholder="Angle, questions for the client, rate offered…" />
            {rw && notes !== o.notes && <div><button className="sm primary" disabled={busy} onClick={() => patch({ notes }, "Notes saved")}>Save notes</button></div>}
          </section>
        </div>
      </div>
    </Modal>
  );
}
