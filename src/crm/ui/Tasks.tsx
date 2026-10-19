"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { crmFetch } from "./api";
import { canWrite, errText, useCrm } from "./store";
import { confirmAction, Empty, Field, Modal, PageHead, Tabs } from "./ui";
import { formatDate, todayISO } from "@/crm/shared/calc";
import { entityHref, type Task, type TaskEntity } from "@/crm/shared/sales";

const ENTITY_LABEL: Record<TaskEntity, string> = { client: "Client", project: "Project", lead: "Lead", enquiry: "Enquiry", opportunity: "Opportunity" };

function dueTone(t: Task, today: string) {
  if (t.done || !t.due_date) return undefined;
  if (t.due_date < today) return { color: "var(--err)" };
  if (t.due_date === today) return { color: "var(--warn)" };
  return undefined;
}

export function TaskModal({ initial, onClose, onSaved }: { initial: Partial<Task>; onClose: () => void; onSaved: () => void }) {
  const { users, ensure, toast, me } = useCrm();
  const [f, setF] = useState<Partial<Task>>({ title: "", notes: "", due_date: null, done: false, assignee_user_id: me?.id ?? null, entity: null, entity_id: null, ...initial });
  const [busy, setBusy] = useState(false);
  useEffect(() => { ensure(["users"]); }, [ensure]);
  const set = (p: Partial<Task>) => setF((x) => ({ ...x, ...p }));
  const save = async () => {
    setBusy(true);
    try {
      await crmFetch(f.id ? `/api/crm/tasks/${f.id}` : "/api/crm/tasks", { method: f.id ? "PUT" : "POST", body: f });
      toast(f.id ? "Task updated" : "Task added");
      onSaved();
    } catch (e) { toast(errText(e), "err"); } finally { setBusy(false); }
  };
  const del = async () => {
    if (!f.id || !confirmAction("Delete this task?")) return;
    try { await crmFetch(`/api/crm/tasks/${f.id}`, { method: "DELETE" }); toast("Task deleted"); onSaved(); } catch (e) { toast(errText(e), "err"); }
  };
  return (
    <Modal title={f.id ? "Edit task" : "New task"} onClose={onClose} footer={<>
      {f.id && <button className="danger" onClick={del} style={{ marginRight: "auto" }}><Trash2 /> Delete</button>}
      <button onClick={onClose}>Cancel</button>
      <button className="primary" disabled={busy || !f.title?.trim()} onClick={save}>{busy ? "Saving…" : "Save"}</button>
    </>}>
      <div className="stack">
        <Field label="Task"><input autoFocus value={f.title} onChange={(e) => set({ title: e.target.value })} placeholder="e.g. Send proposal, follow up on call" /></Field>
        <div className="grid2">
          <Field label="Due date"><input type="date" value={f.due_date ?? ""} onChange={(e) => set({ due_date: e.target.value || null })} /></Field>
          <Field label="Assigned to">
            <select value={f.assignee_user_id ?? ""} onChange={(e) => set({ assignee_user_id: e.target.value || null })}>
              <option value="">Unassigned</option>
              {users.filter((u) => !u.disabled).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Notes"><textarea rows={3} value={f.notes} onChange={(e) => set({ notes: e.target.value })} /></Field>
        {f.entity && f.entity_id && <div className="dim" style={{ fontSize: 12 }}>Linked to {ENTITY_LABEL[f.entity]}{f.entity_label ? `: ${f.entity_label}` : ""}</div>}
        {f.id && <label className="check"><input type="checkbox" checked={!!f.done} onChange={(e) => set({ done: e.target.checked })} /> Done</label>}
      </div>
    </Modal>
  );
}

/** Task list for one record (lead, enquiry, opportunity, client or project). */
export function TaskPanel({ entity, entityId, onChange }: { entity: TaskEntity; entityId: string; onChange?: () => void }) {
  const { me, toast } = useCrm();
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [edit, setEdit] = useState<Partial<Task> | null>(null);
  const load = useCallback(() => crmFetch<Task[]>(`/api/crm/tasks?scope=all&entity=${entity}&entity_id=${entityId}`).then(setTasks).catch((e) => toast(errText(e), "err")), [entity, entityId, toast]);
  useEffect(() => { load(); }, [load]);
  const toggle = async (t: Task) => {
    try { await crmFetch(`/api/crm/tasks/${t.id}/done`, { method: "PATCH", body: { done: !t.done } }); load(); onChange?.(); } catch (e) { toast(errText(e), "err"); }
  };
  const today = todayISO();
  return (
    <div className="stack" style={{ gap: 6 }}>
      {!tasks ? <div className="dim" style={{ fontSize: 13 }}>Loading…</div> : !tasks.length ? <div className="dim" style={{ fontSize: 13 }}>No tasks.</div> : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 4 }}>
          {tasks.map((t) => (
            <li key={t.id} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13 }}>
              <input type="checkbox" checked={t.done} disabled={!canWrite(me?.role)} onChange={() => toggle(t)} aria-label={`Mark ${t.title} ${t.done ? "open" : "done"}`} style={{ marginTop: 3 }} />
              <button className="ghost" style={{ padding: 0, minHeight: 0, textAlign: "left", textDecoration: t.done ? "line-through" : undefined, opacity: t.done ? 0.6 : 1 }} onClick={() => setEdit(t)}>
                {t.title}
                <span className="dim" style={{ fontSize: 11, marginLeft: 6 }}>
                  {t.due_date && <span style={dueTone(t, today)}>{formatDate(t.due_date)}</span>}{t.assignee_name ? ` · ${t.assignee_name.split(" ")[0]}` : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {canWrite(me?.role) && <div><button className="sm" onClick={() => setEdit({ entity, entity_id: entityId })}><Plus /> Add task</button></div>}
      {edit && <TaskModal initial={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); onChange?.(); }} />}
    </div>
  );
}

export function TasksScreen() {
  const { me, toast, users, ensure } = useCrm();
  const [scope, setScope] = useState<"open" | "done" | "all">("open");
  const [who, setWho] = useState<string>("me");
  const [rows, setRows] = useState<Task[] | null>(null);
  const [edit, setEdit] = useState<Partial<Task> | null>(null);
  useEffect(() => { ensure(["users"]); }, [ensure]);
  const load = useCallback(() => {
    const qs = new URLSearchParams({ scope });
    if (who) qs.set("assignee", who);
    return crmFetch<Task[]>(`/api/crm/tasks?${qs}`).then(setRows).catch((e) => toast(errText(e), "err"));
  }, [scope, who, toast]);
  useEffect(() => { load(); }, [load]);
  const toggle = async (t: Task) => {
    try { await crmFetch(`/api/crm/tasks/${t.id}/done`, { method: "PATCH", body: { done: !t.done } }); load(); } catch (e) { toast(errText(e), "err"); }
  };
  const today = todayISO();
  const groups: { label: string; items: Task[] }[] = scope !== "open" ? [{ label: "", items: rows ?? [] }] : [
    { label: "Overdue", items: (rows ?? []).filter((t) => t.due_date && t.due_date < today) },
    { label: "Today", items: (rows ?? []).filter((t) => t.due_date === today) },
    { label: "Upcoming", items: (rows ?? []).filter((t) => t.due_date && t.due_date > today) },
    { label: "No due date", items: (rows ?? []).filter((t) => !t.due_date) },
  ].filter((g) => g.items.length);

  return (
    <>
      <PageHead title="Tasks">{canWrite(me?.role) && <button className="primary" onClick={() => setEdit({})}><Plus /> New task</button>}</PageHead>
      <div className="filters">
        <Tabs value={scope} onChange={setScope} tabs={[{ key: "open", label: "Open" }, { key: "done", label: "Done" }, { key: "all", label: "All" }]} />
        <select value={who} onChange={(e) => setWho(e.target.value)} aria-label="Assigned to">
          <option value="me">Assigned to me</option>
          <option value="">Everyone</option>
          {users.filter((u) => u.id !== me?.id && !u.disabled).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </div>
      <div className="card flush">
        {rows === null ? <Empty>Loading…</Empty> : !rows.length ? <Empty>{scope === "open" ? "Nothing open. Add a task, or add one from a lead or enquiry." : "No tasks."}</Empty> : (
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th style={{ width: 32 }} /><th>Task</th><th>Linked to</th><th>Assigned</th><th className="r">Due</th></tr></thead>
            {groups.map((g) => (
              <tbody key={g.label || "all"}>
                {g.label && <tr><td colSpan={5} className="dim" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".08em", paddingTop: 14 }}>{g.label} · {g.items.length}</td></tr>}
                {g.items.map((t) => {
                  const href = entityHref(t.entity, t.entity_id);
                  return (
                    <tr key={t.id}>
                      <td><input type="checkbox" checked={t.done} disabled={!canWrite(me?.role)} onChange={() => toggle(t)} aria-label={`Mark ${t.title} ${t.done ? "open" : "done"}`} /></td>
                      <td className="click" onClick={() => setEdit(t)} style={t.done ? { textDecoration: "line-through", opacity: 0.6 } : undefined}>
                        <b style={{ fontWeight: 500 }}>{t.title}</b>{t.notes && <div className="dim" style={{ fontSize: 12, whiteSpace: "pre-wrap" }}>{t.notes.slice(0, 160)}</div>}
                      </td>
                      <td>{t.entity && href ? <><span className="dim" style={{ fontSize: 11 }}>{ENTITY_LABEL[t.entity]} </span><Link href={href}>{t.entity_label ?? "open"}</Link></> : <span className="dim">—</span>}</td>
                      <td className="muted">{t.assignee_name ?? "—"}</td>
                      <td className="r nowrap" style={dueTone(t, today)}>{t.due_date ? formatDate(t.due_date) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            ))}
          </table></div>
        )}
      </div>
      {edit && <TaskModal initial={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />}
    </>
  );
}
