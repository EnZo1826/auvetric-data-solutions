"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Copy, Star, Trash2 } from "lucide-react";
import { formatMoney, lineAmount, uid } from "@/crm/shared/calc";
import { PRACTICES, type Currency, type Line, type Service } from "@/crm/shared/types";
import { useCrm } from "./store";
import { Modal } from "./ui";
import { ServiceModal } from "./Services";

export const blankLine = (): Line => ({ id: uid(), item: "", description: "", unit: "Hour", qty: 1, rate: 0, service_id: null });
export const lineFromService = (s: Service): Line => ({ id: uid(), item: s.name, description: s.description, unit: s.unit, qty: 1, rate: Number(s.rate), service_id: s.id });
const rows = (s: string) => Math.min(8, Math.max(1, s.split("\n").length));

export function LineEditor({ lines, onChange, currency, readOnly }: { lines: Line[]; onChange: (l: Line[]) => void; currency: Currency; readOnly?: boolean }) {
  const services = useCrm((s) => s.services);
  const [picker, setPicker] = useState(false);
  const [newService, setNewService] = useState<{ lineId?: string; initial: Partial<Service> } | null>(null);
  const byName = useMemo(() => new Map(services.map((s) => [s.name.toLowerCase(), s])), [services]);

  const update = (i: number, patch: Partial<Line>) => onChange(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= lines.length) return;
    const next = [...lines];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const onItem = (i: number, v: string) => {
    const hit = byName.get(v.trim().toLowerCase());
    const cur = lines[i];
    if (hit && !cur.service_id) update(i, { item: hit.name, description: cur.description || hit.description, unit: hit.unit, rate: cur.rate || Number(hit.rate), service_id: hit.id });
    else update(i, { item: v });
  };
  const num = (v: string) => (v === "" ? 0 : Number(v));

  return (
    <div>
      <div className="lines">
        {lines.map((l, i) => (
          <div className="line" key={l.id}>
            <div className="ln-no">{i + 1}</div>
            <div><input list="crm-services" value={l.item} placeholder="Item / service" aria-label="Item" readOnly={readOnly} onChange={(e) => onItem(i, e.target.value)} /></div>
            <div className="ln-desc"><textarea rows={rows(l.description)} value={l.description} placeholder="Description" aria-label="Description" readOnly={readOnly} onChange={(e) => update(i, { description: e.target.value })} /></div>
            <div className="ln-nums">
              <label>Unit<input value={l.unit} readOnly={readOnly} onChange={(e) => update(i, { unit: e.target.value })} /></label>
              <label>Qty<input type="number" inputMode="decimal" step="any" value={l.qty} readOnly={readOnly} onChange={(e) => update(i, { qty: num(e.target.value) })} /></label>
              <label>Rate<input type="number" inputMode="decimal" step="any" value={l.rate} readOnly={readOnly} onChange={(e) => update(i, { rate: num(e.target.value) })} /></label>
              {!readOnly && (
                <div className="ln-acts">
                  <button type="button" className="ghost icon sm" title="Move up" aria-label="Move up" onClick={() => move(i, -1)}><ArrowUp /></button>
                  <button type="button" className="ghost icon sm" title="Move down" aria-label="Move down" onClick={() => move(i, 1)}><ArrowDown /></button>
                  <button type="button" className="ghost icon sm" title="Duplicate line" aria-label="Duplicate line" onClick={() => { const n = [...lines]; n.splice(i + 1, 0, { ...l, id: uid() }); onChange(n); }}><Copy /></button>
                  {!l.service_id && <button type="button" className="ghost icon sm" title="Save to services" aria-label="Save to services" onClick={() => setNewService({ lineId: l.id, initial: { name: l.item, description: l.description, unit: l.unit, rate: l.rate, currency } })}><Star /></button>}
                  <button type="button" className="ghost icon sm danger" title="Remove line" aria-label="Remove line" onClick={() => onChange(lines.filter((_, j) => j !== i))}><Trash2 /></button>
                </div>
              )}
              <div className="ln-amt">{formatMoney(lineAmount(l), currency)}</div>
            </div>
          </div>
        ))}
        {!lines.length && <div className="empty" style={{ padding: 20 }}>No lines yet.</div>}
      </div>
      <datalist id="crm-services">
        {services.filter((s) => s.active).map((s) => <option key={s.id} value={s.name}>{`${formatMoney(Number(s.rate), s.currency)} / ${s.unit}`}</option>)}
      </datalist>
      {!readOnly && (
        <div className="row" style={{ marginTop: 10 }}>
          <button type="button" className="primary" onClick={() => setPicker(true)}>+ Add services</button>
          <button type="button" onClick={() => onChange([...lines, blankLine()])}>+ Blank line</button>
        </div>
      )}
      {picker && <ServicePicker currency={currency} onClose={() => setPicker(false)} onAdd={(sel) => { onChange([...lines, ...sel.map(lineFromService)]); setPicker(false); }} />}
      {newService && (
        <ServiceModal
          initial={newService.initial}
          onClose={() => setNewService(null)}
          onSaved={(s) => { onChange(lines.map((l) => (l.id === newService.lineId ? { ...l, service_id: s.id } : l))); setNewService(null); }}
        />
      )}
    </div>
  );
}

function ServicePicker({ onClose, onAdd, currency }: { onClose: () => void; onAdd: (s: Service[]) => void; currency: Currency }) {
  const services = useCrm((s) => s.services);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string[]>([]);
  const list = services.filter((s) => s.active && `${s.code} ${s.name} ${s.description}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <Modal title="Add services" onClose={onClose} footer={<>
      <span className="muted grow">{sel.length} selected</span>
      <button onClick={onClose}>Cancel</button>
      <button className="primary" disabled={!sel.length} onClick={() => onAdd(sel.map((id) => services.find((s) => s.id === id)!).filter(Boolean))}>Add {sel.length || ""}</button>
    </>}>
      <input autoFocus type="search" placeholder="Search services…" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 10 }} />
      <div className="picker-list">
        {PRACTICES.map((p) => {
          const items = list.filter((s) => s.practice === p.key);
          if (!items.length) return null;
          return (
            <div key={p.key} className="stack" style={{ gap: 4 }}>
              <div className="dim mono" style={{ fontSize: 11, marginTop: 6 }}><i className="practice-dot" style={{ background: p.color }} />{p.label}</div>
              {items.map((s) => (
                <label key={s.id}>
                  <input type="checkbox" checked={sel.includes(s.id)} onChange={() => setSel((x) => (x.includes(s.id) ? x.filter((y) => y !== s.id) : [...x, s.id]))} />
                  <div className="grow">
                    <div><b>{s.name}</b> {s.code && <span className="dim mono" style={{ fontSize: 11 }}>{s.code}</span>}</div>
                    {s.description && <div className="muted pre" style={{ fontSize: 12 }}>{s.description}</div>}
                    {s.currency !== currency && <div className="dim" style={{ fontSize: 11 }}>Priced in {s.currency}; check the rate for this {currency} document.</div>}
                  </div>
                  <div className="nowrap tabular">{formatMoney(Number(s.rate), s.currency)}<span className="dim"> / {s.unit}</span></div>
                </label>
              ))}
            </div>
          );
        })}
        {!list.length && <div className="empty">No services match. Add them under Admin → Services.</div>}
      </div>
    </Modal>
  );
}
