"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Download, Play, Plus, Trash2 } from "lucide-react";
import { crmFetch } from "./api";
import { canWrite, errText, useCrm } from "./store";
import { confirmAction, Empty, Field, Modal, PageHead } from "./ui";
import { DocumentPrint } from "./DocumentPrint";
import { formatDocNumber, todayISO } from "@/crm/shared/calc";
import { CURRENCIES, PLACEHOLDER, type BoardColumn, type CompanyData, type Currency, type UserRow } from "@/crm/shared/types";

// ───────────────────────── Company profile ─────────────────────────
export function CompanyScreen() {
  const { company, ensure, reload, toast, me } = useCrm();
  const [name, setName] = useState("");
  const [d, setD] = useState<CompanyData | null>(null);
  const [busy, setBusy] = useState(false);
  const admin = me?.role === "admin";
  useEffect(() => { ensure(["company"]); }, [ensure]);
  useEffect(() => { if (company) { setName(company.name); setD(company.data); } }, [company]);
  if (!d) return <Empty>Loading…</Empty>;
  const set = (p: Partial<CompanyData>) => setD({ ...d, ...p });
  const placeholders = Object.entries(d).filter(([, v]) => typeof v === "string" && v.includes(PLACEHOLDER)).length;
  const save = async () => {
    setBusy(true);
    try { await crmFetch("/api/crm/company", { method: "PUT", body: { name, data: d } }); await reload("company"); toast("Company profile saved"); } catch (e) { toast(errText(e), "err"); } finally { setBusy(false); }
  };
  const txt = (k: keyof CompanyData, label: string, opts: { area?: boolean; hint?: string } = {}) => (
    <Field label={label} hint={opts.hint}>
      {opts.area ? <textarea rows={3} value={String(d[k] ?? "")} readOnly={!admin} onChange={(e) => set({ [k]: e.target.value } as Partial<CompanyData>)} />
        : <input value={String(d[k] ?? "")} readOnly={!admin} onChange={(e) => set({ [k]: e.target.value } as Partial<CompanyData>)} style={String(d[k] ?? "").includes(PLACEHOLDER) ? { borderColor: "var(--warn)" } : undefined} />}
    </Field>
  );
  const sample = { type: "invoice" as const, number: formatDocNumber(d.invoicePrefix, d.nextInvoice, d.numberPad), date: todayISO(), due_date: todayISO(), currency: d.defaultCurrency,
    data: { client: { name: "Sample Client (Pty) Ltd", address: "1 Example Street\nWindhoek", email: "accounts@example.com", phone: "", contact: "A. Person", vat_no: "" }, remarks: "Preview only", lines: [{ id: "1", item: "Software development", description: "Sample line", unit: "Hour", qty: 10, rate: 850 }], discount: 0, vatRate: d.vatRegistered ? d.vatRate : 0, notes: "" } };

  return (
    <>
      <PageHead title="Company profile">{admin && <button className="primary" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save"}</button>}</PageHead>
      {placeholders > 0 && <div className="warn-box" style={{ marginBottom: 12 }}>{placeholders} field(s) still say “{PLACEHOLDER}”. They are highlighted on printed documents until you replace them.</div>}
      {!admin && <div className="dim" style={{ marginBottom: 10, fontSize: 12 }}>Only admins can change the company profile.</div>}
      <div className="split">
        <div className="stack">
          <section className="card stack">
            <h2 style={{ margin: 0 }}>Identity</h2>
            <div className="grid2">
              <Field label="Display name"><input value={name} readOnly={!admin} onChange={(e) => setName(e.target.value)} /></Field>
              {txt("legalName", "Legal name (printed)")}
              {txt("tradingName", "Trading name")}
              {txt("regNo", "Registration number")}
            </div>
            {txt("address", "Address", { area: true })}
            <div className="grid3">{txt("email", "Email")}{txt("phone", "Phone")}{txt("website", "Website")}</div>
          </section>
          <section className="card stack">
            <h2 style={{ margin: 0 }}>VAT</h2>
            <label className="check"><input type="checkbox" checked={d.vatRegistered} disabled={!admin} onChange={(e) => set({ vatRegistered: e.target.checked })} /> Registered for VAT with NamRA</label>
            {d.vatRegistered ? <div className="grid2">{txt("vatNo", "VAT number")}<Field label="Standard rate %"><input type="number" step="any" value={d.vatRate} readOnly={!admin} onChange={(e) => set({ vatRate: Number(e.target.value) })} /></Field></div>
              : <p className="muted" style={{ margin: 0, fontSize: 13 }}>While unregistered, invoices print as “INVOICE” and no VAT is charged. Only VAT-registered vendors may issue tax invoices; confirm the registration threshold with your accountant.</p>}
          </section>
          <section className="card stack">
            <h2 style={{ margin: 0 }}>Banking (printed on invoices)</h2>
            <div className="grid2">{txt("bankAccountName", "Account name")}{txt("bankName", "Bank")}{txt("bankBranch", "Branch")}{txt("bankBranchCode", "Branch code")}{txt("bankAccount", "Account number")}{txt("bankSwift", "SWIFT / BIC")}</div>
            {txt("bankExtra", "Extra payment notes", { area: true })}
          </section>
          <section className="card stack">
            <h2 style={{ margin: 0 }}>Documents</h2>
            <div className="grid4">
              {txt("invoicePrefix", "Invoice prefix", { hint: "{YYYY} = year" })}
              <Field label="Next invoice no."><input type="number" min={1} value={d.nextInvoice} readOnly={!admin} onChange={(e) => set({ nextInvoice: Math.max(1, Number(e.target.value) || 1) })} /></Field>
              {txt("quotePrefix", "Quote prefix")}
              <Field label="Next quote no."><input type="number" min={1} value={d.nextQuote} readOnly={!admin} onChange={(e) => set({ nextQuote: Math.max(1, Number(e.target.value) || 1) })} /></Field>
              <Field label="Number digits"><input type="number" min={1} max={8} value={d.numberPad} readOnly={!admin} onChange={(e) => set({ numberPad: Number(e.target.value) || 4 })} /></Field>
              <Field label="Payment terms (days)"><input type="number" min={0} value={d.paymentTermsDays} readOnly={!admin} onChange={(e) => set({ paymentTermsDays: Number(e.target.value) || 0 })} /></Field>
              <Field label="Quotes valid (days)"><input type="number" min={1} value={d.quoteValidDays} readOnly={!admin} onChange={(e) => set({ quoteValidDays: Number(e.target.value) || 30 })} /></Field>
              <Field label="Default currency"><select value={d.defaultCurrency} disabled={!admin} onChange={(e) => set({ defaultCurrency: e.target.value as Currency })}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
              <Field label="Default NAD per 1 USD" hint="Offered on new USD documents"><input type="number" step="any" min={0} value={d.usdToNad} readOnly={!admin} onChange={(e) => set({ usdToNad: Number(e.target.value) })} /></Field>
            </div>
            <div className="dim" style={{ fontSize: 12 }}>Next invoice: <span className="mono">{formatDocNumber(d.invoicePrefix, d.nextInvoice, d.numberPad)}</span> · next quote: <span className="mono">{formatDocNumber(d.quotePrefix, d.nextQuote, d.numberPad)}</span></div>
            {txt("terms", "Terms (printed)", { area: true })}
            {txt("footerText", "Footer line (optional)")}
          </section>
        </div>
        <aside className="stack">
          <div className="dim mono" style={{ fontSize: 11 }}>PREVIEW</div>
          <div style={{ transform: "scale(0.42)", transformOrigin: "top left", width: "210mm", height: "125mm" }}><DocumentPrint doc={sample} company={{ name, data: d }} /></div>
        </aside>
      </div>
    </>
  );
}

// ───────────────────────── Users ─────────────────────────
export function UsersScreen() {
  const { users, ensure, reload, toast, me } = useCrm();
  const [add, setAdd] = useState(false);
  const [otp, setOtp] = useState<{ email: string; pw: string } | null>(null);
  const admin = me?.role === "admin";
  useEffect(() => { ensure(["users"]); }, [ensure]);
  const act = async (u: UserRow, what: "password" | "mfa" | "unlock") => {
    const msg = { password: `Issue a new one-time password for ${u.name}? They'll be signed out everywhere.`, mfa: `Reset two-factor for ${u.name}? They'll enrol a new authenticator at next sign-in.`, unlock: `Unlock ${u.name}?` }[what];
    if (!confirmAction(msg)) return;
    try {
      const r = await crmFetch<{ oneTimePassword?: string }>(`/api/crm/users/${u.id}/reset`, { method: "POST", body: { what } });
      if (r.oneTimePassword) setOtp({ email: u.email, pw: r.oneTimePassword });
      toast("Done"); reload("users");
    } catch (e) { toast(errText(e), "err"); }
  };
  const patch = async (u: UserRow, body: Partial<UserRow>) => {
    try { await crmFetch(`/api/crm/users/${u.id}`, { method: "PATCH", body }); reload("users"); toast("Saved"); } catch (e) { toast(errText(e), "err"); }
  };
  return (
    <>
      <PageHead title="Users">{admin && <button className="primary" onClick={() => setAdd(true)}><Plus /> Add user</button>}</PageHead>
      <div className="card flush"><div className="tbl-wrap"><table className="tbl">
        <thead><tr><th>Name</th><th>Role</th><th>Two-factor</th><th>Last sign-in</th><th>Status</th>{admin && <th></th>}</tr></thead>
        <tbody>{users.map((u) => (
          <tr key={u.id}>
            <td><b>{u.name}</b>{u.id === me?.id && <span className="badge info" style={{ marginLeft: 6 }}>you</span>}<div className="dim" style={{ fontSize: 12 }}>{u.email}</div></td>
            <td>{admin && u.id !== me?.id ? <select style={{ width: "auto" }} value={u.role} onChange={(e) => patch(u, { role: e.target.value as UserRow["role"] })}><option value="admin">admin</option><option value="member">member</option><option value="readonly">read-only</option></select> : u.role}</td>
            <td>{u.totp_enabled ? <span className="badge ok">enabled</span> : <span className="badge warn">pending enrolment</span>}</td>
            <td className="muted">{u.last_login_at ? new Intl.DateTimeFormat("en-NA", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Windhoek" }).format(new Date(u.last_login_at)) : "never"}</td>
            <td>{u.disabled ? <span className="badge err">disabled</span> : u.locked ? <span className="badge warn">locked</span> : <span className="badge ok">active</span>}</td>
            {admin && <td className="r nowrap">{u.id !== me?.id && <>
              {u.locked && <button className="sm" onClick={() => act(u, "unlock")}>Unlock</button>}
              <button className="sm" onClick={() => act(u, "password")}>New password</button>
              <button className="sm" onClick={() => act(u, "mfa")}>Reset 2FA</button>
              <button className="sm danger" onClick={() => confirmAction(`${u.disabled ? "Enable" : "Disable"} ${u.name}?`) && patch(u, { disabled: !u.disabled })}>{u.disabled ? "Enable" : "Disable"}</button>
            </>}</td>}
          </tr>))}</tbody>
      </table></div></div>
      <p className="dim" style={{ fontSize: 12, marginTop: 10 }}>Two-factor sign-in is mandatory. New users get a one-time password and choose their own at first sign-in. Your own password and sessions are under My account.</p>
      {add && <AddUser onClose={() => setAdd(false)} onDone={(email, pw) => { setAdd(false); setOtp({ email, pw }); reload("users"); }} />}
      {otp && (
        <Modal title="One-time password" onClose={() => setOtp(null)} footer={<button className="primary" onClick={() => setOtp(null)}>I&apos;ve handed it over</button>}>
          <div className="stack">
            <p style={{ margin: 0 }}>Give this to <b>{otp.email}</b> in person or by phone, not by email. It is shown once.</p>
            <div className="secret" style={{ fontSize: 18 }}>{otp.pw}</div>
            <p className="muted" style={{ margin: 0, fontSize: 13 }}>At sign-in they set their own password and link an authenticator app.</p>
          </div>
        </Modal>
      )}
    </>
  );
}

function AddUser({ onClose, onDone }: { onClose: () => void; onDone: (email: string, pw: string) => void }) {
  const { toast } = useCrm();
  const [f, setF] = useState({ email: "", name: "", role: "member" });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try { const r = await crmFetch<{ email: string; oneTimePassword: string }>("/api/crm/users", { method: "POST", body: f }); onDone(r.email, r.oneTimePassword); } catch (e) { toast(errText(e), "err"); } finally { setBusy(false); }
  };
  return (
    <Modal title="Add user" onClose={onClose} footer={<><button onClick={onClose}>Cancel</button><button className="primary" disabled={busy || !f.email || !f.name} onClick={save}>Create</button></>}>
      <div className="stack">
        <Field label="Name"><input autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Email"><input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Role"><select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}><option value="admin">Admin: everything, including company profile, users and backups</option><option value="member">Member: all CRM work</option><option value="readonly">Read-only</option></select></Field>
      </div>
    </Modal>
  );
}

// ───────────────────────── Settings ─────────────────────────
export function SettingsScreen() {
  const { columns, ensure, reload, toast, me } = useCrm();
  const [cols, setCols] = useState<BoardColumn[]>([]);
  const [busy, setBusy] = useState(false);
  const admin = me?.role === "admin";
  useEffect(() => { ensure(["columns"]); }, [ensure]);
  useEffect(() => setCols(columns), [columns]);
  const saveCols = async () => {
    setBusy(true);
    try { await crmFetch("/api/crm/settings/project_columns", { method: "PUT", body: cols }); await reload("columns"); toast("Board columns saved"); } catch (e) { toast(errText(e), "err"); } finally { setBusy(false); }
  };
  const exportAll = async () => {
    try {
      const data = await crmFetch("/api/crm/export");
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `auvetric-crm-backup-${todayISO()}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    } catch (e) { toast(errText(e), "err"); }
  };
  const runDaily = async () => {
    try {
      const r = await crmFetch<{ retainers: { created: unknown[] }; overdue: number }>("/api/crm/run-daily", { method: "POST", body: {} });
      toast(`Daily job: ${r.retainers.created.length} retainer invoice(s), ${r.overdue} marked overdue`);
    } catch (e) { toast(errText(e), "err"); }
  };
  const move = (i: number, d: number) => { const n = [...cols]; const j = i + d; if (j < 0 || j >= n.length) return; [n[i], n[j]] = [n[j], n[i]]; setCols(n); };
  return (
    <>
      <PageHead title="Settings" />
      <div className="grid2">
        <section className="card stack">
          <h2 style={{ margin: 0 }}>Project board columns</h2>
          {cols.map((c, i) => (
            <div key={c.key + i} className="row" style={{ flexWrap: "nowrap" }}>
              <input type="color" value={c.color} disabled={!admin} aria-label="Colour" style={{ width: 44, padding: 2, height: 34 }} onChange={(e) => setCols(cols.map((x, j) => (j === i ? { ...x, color: e.target.value } : x)))} />
              <input value={c.label} readOnly={!admin} onChange={(e) => setCols(cols.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
              {admin && <><button className="ghost icon sm" aria-label="Up" onClick={() => move(i, -1)}><ArrowUp /></button><button className="ghost icon sm" aria-label="Down" onClick={() => move(i, 1)}><ArrowDown /></button>
                <button className="ghost icon sm danger" aria-label="Remove" onClick={() => setCols(cols.filter((_, j) => j !== i))}><Trash2 /></button></>}
            </div>
          ))}
          {admin && <div className="row"><button className="sm" onClick={() => setCols([...cols, { key: "", label: "New column", color: "#6b7c95" }])}><Plus /> Column</button><div className="grow" /><button className="primary" disabled={busy} onClick={saveCols}>Save columns</button></div>}
          <p className="dim" style={{ fontSize: 12, margin: 0 }}>The first column is where new projects start. A column can only be removed once it&apos;s empty.</p>
        </section>
        <section className="card stack">
          <h2 style={{ margin: 0 }}>Data</h2>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>Download every client, contact, service, retainer, project, quote, invoice and note as one JSON file. Keep it somewhere safe; it contains client details.</p>
          <div className="row">{admin ? <button onClick={exportAll}><Download /> Download backup</button> : <span className="dim" style={{ fontSize: 12 }}>Admins only.</span>}</div>
          <h2 style={{ margin: "10px 0 0" }}>Daily job</h2>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>Runs automatically at 06:00 Windhoek on the live site. Running it now is safe: it never invoices a retainer twice.</p>
          <div className="row">{canWrite(me?.role) && admin && <button onClick={runDaily}><Play /> Run now</button>}</div>
        </section>
      </div>
    </>
  );
}
