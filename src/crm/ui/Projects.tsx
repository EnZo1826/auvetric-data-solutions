"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { crmFetch } from "./api";
import { canWrite, errText, useCrm } from "./store";
import { confirmAction, Empty, Field, Modal, Money, PageHead, StatusBadge, Tabs } from "./ui";
import { Timeline } from "./Clients";
import { formatDate, todayISO, uid } from "@/crm/shared/calc";
import { CURRENCIES, PRACTICES, practiceLabel, type Activity, type Currency, type Project } from "@/crm/shared/types";

type Row = Project & { client_name: string | null; lead_name: string | null; doc_count: number };
const PRI: Record<string, string> = { urgent: "#f16b77", high: "#f0b35a", normal: "#0069f5", low: "#6b7c95" };

const emptyProject = (status: string): Partial<Project> => ({
  title: "", status, priority: "normal", client_id: null, practice: null, lead_user_id: null, start_date: null, due_date: null,
  budget_amount: null, budget_currency: "NAD", budget_hours: null,
  data: { description: "", checklist: [], milestones: [], tags: [], hours: 0 },
});

export function ProjectsBoard() {
  const router = useRouter();
  const search = useSearchParams();
  const { columns, clients, users, ensure, me, toast } = useCrm();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [edit, setEdit] = useState<Partial<Project> | null>(null);
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<{ col: string; index: number } | null>(null);
  const [q, setQ] = useState("");
  const [mine, setMine] = useState(false);
  const rw = canWrite(me?.role);

  useEffect(() => { ensure(["columns", "clients", "users"]); }, [ensure]);
  const load = useCallback(() => crmFetch<Row[]>("/api/crm/projects").then(setRows).catch((e) => toast(errText(e), "err")), [toast]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const open = search.get("open");
    if (open && rows) { const p = rows.find((r) => r.id === open); if (p) setEdit(p); router.replace("/crm/projects"); }
  }, [search, rows, router]);

  const filtered = useMemo(() => (rows ?? []).filter((p) => (!mine || p.lead_user_id === me?.id) && `${p.title} ${p.client_name ?? ""} ${p.data.tags.join(" ")}`.toLowerCase().includes(q.toLowerCase())), [rows, q, mine, me]);
  const inCol = (key: string) => filtered.filter((p) => p.status === key).sort((a, b) => a.position - b.position);
  const known = new Set(columns.map((c) => c.key));
  const orphans = filtered.filter((p) => !known.has(p.status));

  const move = async (pid: string, col: string, index: number) => {
    const all = rows ?? [];
    const target = all.filter((p) => p.status === col && p.id !== pid).sort((a, b) => a.position - b.position);
    const p = all.find((x) => x.id === pid);
    if (!p) return;
    target.splice(index, 0, { ...p, status: col });
    const ids = target.map((x) => x.id);
    setRows(all.map((x) => (x.id === pid ? { ...x, status: col } : x)).map((x) => (ids.includes(x.id) ? { ...x, position: (ids.indexOf(x.id) + 1) * 1000 } : x)));
    try { await crmFetch("/api/crm/projects/move", { method: "POST", body: { id: pid, status: col, ids } }); } catch (e) { toast(errText(e), "err"); load(); }
  };
  const today = todayISO();

  return (
    <>
      <PageHead title="Projects">
        {rw && <button className="primary" onClick={() => setEdit(emptyProject(columns[0]?.key ?? "planned"))}><Plus /> New project</button>}
      </PageHead>
      <div className="filters">
        <input type="search" placeholder="Search projects, clients, tags…" value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="check"><input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} /> Led by me</label>
        <span className="dim" style={{ fontSize: 12 }}>Drag cards between columns. On a phone, change the stage inside the project.</span>
      </div>
      {rows === null ? <Empty>Loading…</Empty> : (
        <div className="board">
          {[...columns, ...(orphans.length ? [{ key: "__orphan", label: "Unknown column", color: "#f16b77" }] : [])].map((col) => {
            const list = col.key === "__orphan" ? orphans : inCol(col.key);
            return (
              <div key={col.key} className={"col" + (over?.col === col.key ? " over" : "")}
                onDragOver={(e) => { if (drag && col.key !== "__orphan") { e.preventDefault(); if (over?.col !== col.key) setOver({ col: col.key, index: list.length }); } }}
                onDrop={(e) => { e.preventDefault(); if (drag && over) move(drag, col.key, over.index); setDrag(null); setOver(null); }}>
                <div className="col-h"><i style={{ background: col.color }} />{col.label}<span className="dim" style={{ marginLeft: "auto", fontWeight: 400 }}>{list.length}</span></div>
                <div className="col-b">
                  {list.map((p, i) => {
                    const done = p.data.checklist.filter((c) => c.done).length;
                    const late = p.due_date && p.due_date < today && col.key !== "done";
                    return (
                      <div key={p.id}>
                        {over?.col === col.key && over.index === i && drag !== p.id && <div className="drop-marker" />}
                        <div className={"pcard" + (drag === p.id ? " dragging" : "")} style={{ ["--c" as string]: PRI[p.priority] }} draggable={rw}
                          onDragStart={(e) => { setDrag(p.id); e.dataTransfer.effectAllowed = "move"; }}
                          onDragEnd={() => { setDrag(null); setOver(null); }}
                          onDragOver={(e) => { if (!drag) return; e.preventDefault(); e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); const idx = e.clientY < r.top + r.height / 2 ? i : i + 1; if (over?.col !== col.key || over.index !== idx) setOver({ col: col.key, index: idx }); }}
                          onClick={() => setEdit(p)} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && setEdit(p)}>
                          <div className="t">{p.title}</div>
                          <div className="m">
                            {p.client_name && <span>{p.client_name}</span>}
                            {p.practice && <span><i className="practice-dot" style={{ background: PRACTICES.find((x) => x.key === p.practice)?.color }} />{practiceLabel(p.practice).split(" ")[0]}</span>}
                          </div>
                          <div className="m">
                            {p.priority !== "normal" && <StatusBadge s={p.priority} />}
                            {p.due_date && <span style={late ? { color: "var(--err)" } : undefined}>Due {formatDate(p.due_date)}</span>}
                            {[p.lead_name?.split(" ")[0], p.doc_count > 0 ? `${p.doc_count} doc${p.doc_count > 1 ? "s" : ""}` : null].filter(Boolean).join(" · ") && (
                              <span>{[p.lead_name?.split(" ")[0], p.doc_count > 0 ? `${p.doc_count} doc${p.doc_count > 1 ? "s" : ""}` : null].filter(Boolean).join(" · ")}</span>
                            )}
                          </div>
                          {p.data.checklist.length > 0 && <div className="progress" title={`${done}/${p.data.checklist.length} done`}><i style={{ width: `${(done / p.data.checklist.length) * 100}%` }} /></div>}
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
      {edit && <ProjectModal initial={edit} clients={clients} users={users} columns={columns} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />}
    </>
  );
}

type Detail = { project: Project; documents: { id: string; type: "invoice" | "quote"; number: string; status: string; date: string; total: number; currency: Currency }[]; activities: Activity[] };

function ProjectModal({ initial, clients, users, columns, onClose, onSaved }: {
  initial: Partial<Project>; clients: ReturnType<typeof useCrm.getState>["clients"]; users: ReturnType<typeof useCrm.getState>["users"];
  columns: ReturnType<typeof useCrm.getState>["columns"]; onClose: () => void; onSaved: () => void;
}) {
  const { me, toast } = useCrm();
  const [f, setF] = useState<Partial<Project>>(initial);
  const [tab, setTab] = useState<"details" | "checklist" | "activity">("details");
  const [detail, setDetail] = useState<Detail | null>(null);
  const [newItem, setNewItem] = useState("");
  const [busy, setBusy] = useState(false);
  const rw = canWrite(me?.role);
  const set = (p: Partial<Project>) => setF((x) => ({ ...x, ...p }));
  const data = f.data!;
  const setData = (p: Partial<Project["data"]>) => setF((x) => ({ ...x, data: { ...x.data!, ...p } }));
  const loadDetail = useCallback(() => { if (initial.id) crmFetch<Detail>(`/api/crm/projects/${initial.id}`).then(setDetail).catch(() => {}); }, [initial.id]);
  useEffect(() => { loadDetail(); }, [loadDetail]);

  const save = async () => {
    setBusy(true);
    try {
      await crmFetch(f.id ? `/api/crm/projects/${f.id}` : "/api/crm/projects", { method: f.id ? "PUT" : "POST", body: f });
      toast(f.id ? "Project saved" : "Project created");
      onSaved();
    } catch (e) { toast(errText(e), "err"); } finally { setBusy(false); }
  };
  const remove = async () => {
    if (!f.id || !confirmAction(`Delete project “${f.title}”? Linked quotes and invoices are kept.`)) return;
    try { await crmFetch(`/api/crm/projects/${f.id}`, { method: "DELETE" }); toast("Project deleted"); onSaved(); } catch (e) { toast(errText(e), "err"); }
  };
  const done = data.checklist.filter((c) => c.done).length;

  return (
    <Modal wide title={f.id ? f.title || "Project" : "New project"} onClose={onClose} footer={<>
      {f.id && rw && <button className="danger" onClick={remove}><Trash2 /> Delete</button>}
      <div className="grow" />
      {f.id && <Link className="btn" href={`/crm/invoices/new?project_id=${f.id}${f.client_id ? `&client_id=${f.client_id}` : ""}`}>New invoice</Link>}
      <button onClick={onClose}>Close</button>
      {rw && <button className="primary" disabled={busy || !f.title?.trim()} onClick={save}>{busy ? "Saving…" : "Save"}</button>}
    </>}>
      <Tabs value={tab} onChange={setTab} tabs={[{ key: "details", label: "Details" }, { key: "checklist", label: `Checklist & milestones (${done}/${data.checklist.length})` }, ...(f.id ? [{ key: "activity" as const, label: "Activity & documents" }] : [])]} />
      {tab === "details" && (
        <div className="stack">
          <Field label="Title"><input autoFocus value={f.title ?? ""} readOnly={!rw} onChange={(e) => set({ title: e.target.value })} /></Field>
          <div className="grid3">
            <Field label="Client"><select value={f.client_id ?? ""} disabled={!rw} onChange={(e) => set({ client_id: e.target.value || null })}><option value="">None</option>{clients.filter((c) => !c.archived || c.id === f.client_id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
            <Field label="Stage"><select value={f.status} disabled={!rw} onChange={(e) => set({ status: e.target.value })}>{columns.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</select></Field>
            <Field label="Priority"><select value={f.priority} disabled={!rw} onChange={(e) => set({ priority: e.target.value as Project["priority"] })}>{["low", "normal", "high", "urgent"].map((p) => <option key={p}>{p}</option>)}</select></Field>
            <Field label="Practice"><select value={f.practice ?? ""} disabled={!rw} onChange={(e) => set({ practice: (e.target.value || null) as Project["practice"] })}><option value="">—</option>{PRACTICES.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}</select></Field>
            <Field label="Lead partner"><select value={f.lead_user_id ?? ""} disabled={!rw} onChange={(e) => set({ lead_user_id: e.target.value || null })}><option value="">—</option>{users.filter((u) => !u.disabled).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field>
            <Field label="Tags (comma separated)"><input value={data.tags.join(", ")} readOnly={!rw} onChange={(e) => setData({ tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })} /></Field>
            <Field label="Start"><input type="date" value={f.start_date ?? ""} readOnly={!rw} onChange={(e) => set({ start_date: e.target.value || null })} /></Field>
            <Field label="Due"><input type="date" value={f.due_date ?? ""} readOnly={!rw} onChange={(e) => set({ due_date: e.target.value || null })} /></Field>
            <Field label="Hours logged (until Time ships)"><input type="number" step="any" min={0} value={data.hours} readOnly={!rw} onChange={(e) => setData({ hours: Number(e.target.value) || 0 })} /></Field>
          </div>
          <div className="grid3">
            <Field label="Budget amount"><input type="number" step="any" min={0} value={f.budget_amount ?? ""} readOnly={!rw} onChange={(e) => set({ budget_amount: e.target.value === "" ? null : Number(e.target.value) })} /></Field>
            <Field label="Budget currency"><select value={f.budget_currency} disabled={!rw} onChange={(e) => set({ budget_currency: e.target.value as Currency })}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
            <Field label="Budget hours" hint={f.budget_hours ? `${Math.round((data.hours / Number(f.budget_hours)) * 100)}% used` : undefined}><input type="number" step="any" min={0} value={f.budget_hours ?? ""} readOnly={!rw} onChange={(e) => set({ budget_hours: e.target.value === "" ? null : Number(e.target.value) })} /></Field>
          </div>
          <Field label="Description"><textarea rows={5} value={data.description} readOnly={!rw} onChange={(e) => setData({ description: e.target.value })} /></Field>
        </div>
      )}
      {tab === "checklist" && (
        <div className="grid2">
          <section className="stack">
            <h3>Checklist</h3>
            {data.checklist.map((c, i) => (
              <div key={c.id} className="row" style={{ flexWrap: "nowrap" }}>
                <input type="checkbox" checked={c.done} disabled={!rw} onChange={(e) => setData({ checklist: data.checklist.map((x, j) => (j === i ? { ...x, done: e.target.checked } : x)) })} aria-label="Done" />
                <input value={c.text} readOnly={!rw} style={c.done ? { textDecoration: "line-through", opacity: 0.6 } : undefined} onChange={(e) => setData({ checklist: data.checklist.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })} />
                {rw && <button className="ghost icon sm danger" aria-label="Remove" onClick={() => setData({ checklist: data.checklist.filter((_, j) => j !== i) })}><Trash2 /></button>}
              </div>
            ))}
            {rw && <form className="row" style={{ flexWrap: "nowrap" }} onSubmit={(e) => { e.preventDefault(); if (newItem.trim()) { setData({ checklist: [...data.checklist, { id: uid(), text: newItem.trim(), done: false }] }); setNewItem(""); } }}>
              <input value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder="Add an item and press Enter" /><button className="sm">Add</button>
            </form>}
          </section>
          <section className="stack">
            <h3>Milestones</h3>
            {data.milestones.map((m, i) => (
              <div key={m.id} className="row" style={{ flexWrap: "nowrap" }}>
                <input type="checkbox" checked={m.done} disabled={!rw} onChange={(e) => setData({ milestones: data.milestones.map((x, j) => (j === i ? { ...x, done: e.target.checked } : x)) })} aria-label="Reached" />
                <input value={m.title} readOnly={!rw} onChange={(e) => setData({ milestones: data.milestones.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) })} />
                <input type="date" style={{ width: 150 }} value={m.due ?? ""} readOnly={!rw} onChange={(e) => setData({ milestones: data.milestones.map((x, j) => (j === i ? { ...x, due: e.target.value || null } : x)) })} />
                {rw && <button className="ghost icon sm danger" aria-label="Remove" onClick={() => setData({ milestones: data.milestones.filter((_, j) => j !== i) })}><Trash2 /></button>}
              </div>
            ))}
            {rw && <button className="sm" style={{ alignSelf: "flex-start" }} onClick={() => setData({ milestones: [...data.milestones, { id: uid(), title: "", due: null, done: false }] })}><Plus /> Milestone</button>}
          </section>
        </div>
      )}
      {tab === "activity" && f.id && (
        <div className="grid2">
          <section><h3>Activity</h3>{detail ? <Timeline entity="project" entityId={f.id} items={detail.activities} onChange={loadDetail} /> : <Empty>Loading…</Empty>}</section>
          <section>
            <h3>Quotes & invoices</h3>
            {!detail?.documents.length ? <div className="dim" style={{ fontSize: 13 }}>None linked. Link documents from the quote or invoice editor.</div> : (
              <table className="tbl"><tbody>{detail.documents.map((d) => (
                <tr key={d.id}><td><Link className="mono" href={`/crm/${d.type}s/${d.id}`}>{d.number}</Link></td><td><StatusBadge s={d.status} /></td><td className="r"><Money v={Number(d.total)} c={d.currency} /></td></tr>
              ))}</tbody></table>
            )}
          </section>
        </div>
      )}
    </Modal>
  );
}
