"use client";

import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { crmFetch } from "./api";
import { canWrite, errText, useCrm } from "./store";
import { confirmAction, Empty, Field, Modal, Money, PageHead } from "./ui";
import { CURRENCIES, PRACTICES, type Practice, type Service } from "@/crm/shared/types";

const UNITS = ["Hour", "Day", "Fixed", "Month", "Unit", "Licence"];

export function ServiceModal({ initial, onClose, onSaved }: { initial: Partial<Service>; onClose: () => void; onSaved: (s: Service) => void }) {
  const { reload, toast } = useCrm();
  const [f, setF] = useState<Partial<Service>>({ practice: "engineering", unit: "Hour", rate: 0, currency: "NAD", active: true, code: "", description: "", ...initial });
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<Service>) => setF((x) => ({ ...x, ...p }));
  const save = async () => {
    setBusy(true);
    try {
      const s = await crmFetch<Service>(f.id ? `/api/crm/services/${f.id}` : "/api/crm/services", { method: f.id ? "PUT" : "POST", body: f });
      await reload("services");
      toast(f.id ? "Service updated" : "Service added");
      onSaved(s);
    } catch (e) { toast(errText(e), "err"); } finally { setBusy(false); }
  };
  return (
    <Modal title={f.id ? "Edit service" : "New service"} onClose={onClose} footer={<>
      <button onClick={onClose}>Cancel</button>
      <button className="primary" disabled={busy || !f.name?.trim()} onClick={save}>{busy ? "Saving…" : "Save"}</button>
    </>}>
      <div className="stack">
        <div className="grid2">
          <Field label="Practice">
            <select value={f.practice} onChange={(e) => set({ practice: e.target.value as Practice })}>
              {PRACTICES.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
          </Field>
          <Field label="Code (optional)"><input value={f.code ?? ""} onChange={(e) => set({ code: e.target.value })} placeholder="e.g. ENG-DEV" /></Field>
        </div>
        <Field label="Name"><input autoFocus value={f.name ?? ""} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Software development" /></Field>
        <Field label="Description (printed on documents)"><textarea rows={3} value={f.description ?? ""} onChange={(e) => set({ description: e.target.value })} /></Field>
        <div className="grid3">
          <Field label="Unit">
            <input list="crm-units" value={f.unit ?? ""} onChange={(e) => set({ unit: e.target.value })} />
            <datalist id="crm-units">{UNITS.map((u) => <option key={u} value={u} />)}</datalist>
          </Field>
          <Field label="Rate"><input type="number" step="any" inputMode="decimal" value={f.rate ?? 0} onChange={(e) => set({ rate: Number(e.target.value) })} /></Field>
          <Field label="Currency">
            <select value={f.currency} onChange={(e) => set({ currency: e.target.value as Service["currency"] })}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select>
          </Field>
        </div>
        <label className="check"><input type="checkbox" checked={f.active !== false} onChange={(e) => set({ active: e.target.checked })} /> Active (offered when adding lines)</label>
      </div>
    </Modal>
  );
}

export function ServicesScreen() {
  const { services, ensure, reload, toast, me } = useCrm();
  const [edit, setEdit] = useState<Partial<Service> | null>(null);
  const [q, setQ] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  useEffect(() => { ensure(["services"]); }, [ensure]);
  const rw = canWrite(me?.role);
  const list = useMemo(() => services.filter((s) => (showInactive || s.active) && `${s.code} ${s.name} ${s.description}`.toLowerCase().includes(q.toLowerCase())), [services, q, showInactive]);

  const remove = async (s: Service) => {
    if (!confirmAction(`Delete “${s.name}”? Existing documents keep their lines.`)) return;
    try { await crmFetch(`/api/crm/services/${s.id}`, { method: "DELETE" }); await reload("services"); toast("Service deleted"); } catch (e) { toast(errText(e), "err"); }
  };

  return (
    <>
      <PageHead title="Services">{rw && <button className="primary" onClick={() => setEdit({})}><Plus /> New service</button>}</PageHead>
      <div className="filters">
        <input type="search" placeholder="Search services…" value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="check"><input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> Show inactive</label>
      </div>
      {PRACTICES.map((p) => {
        const items = list.filter((s) => s.practice === p.key);
        return (
          <section key={p.key} className="card flush" style={{ marginBottom: 12 }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--line)" }} className="row">
              <i className="practice-dot" style={{ background: p.color }} /><h2 style={{ margin: 0 }}>{p.label}</h2>
              <span className="dim" style={{ fontSize: 12 }}>{items.length}</span>
            </div>
            {items.length ? (
              <div className="tbl-wrap"><table className="tbl">
                <thead><tr><th>Service</th><th>Unit</th><th className="r">Rate</th><th><span className="sr-only">Actions</span></th></tr></thead>
                <tbody>
                  {items.map((s) => (
                    <tr key={s.id} style={s.active ? undefined : { opacity: 0.55 }}>
                      <td><b>{s.name}</b> {s.code && <span className="dim mono" style={{ fontSize: 11 }}>{s.code}</span>}{s.description && <div className="muted pre" style={{ fontSize: 12 }}>{s.description}</div>}</td>
                      <td>{s.unit}</td>
                      <td className="r"><Money v={Number(s.rate)} c={s.currency} /></td>
                      <td className="r nowrap">{rw && <><button className="ghost icon sm" aria-label="Edit" onClick={() => setEdit(s)}><Pencil /></button><button className="ghost sm danger" onClick={() => remove(s)}>Delete</button></>}</td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            ) : <Empty>No services in this practice yet.</Empty>}
          </section>
        );
      })}
      {edit && <ServiceModal initial={edit} onClose={() => setEdit(null)} onSaved={() => setEdit(null)} />}
    </>
  );
}
