"use client";

import { useCallback, useEffect, useState } from "react";
import { DatabaseBackup, Download, Save, Send } from "lucide-react";
import { crmFetch } from "./api";
import { errText, useCrm } from "./store";
import { Empty, Field } from "./ui";
import { fmtSize } from "./Attachments";

type Tpl = { subject: string; body: string };
type MailView = { configured: boolean; host: string; port: number; security: "ssl" | "starttls" | "none"; user: string; hasPassword: boolean; fromName: string; fromEmail: string;
  replyTo: string; bccSender: boolean; templates: Record<"invoice" | "quote" | "statement", Tpl>; presets: { key: string; label: string; host: string }[] };
const TPL_LABEL = { invoice: "Invoice", quote: "Quote", statement: "Statement" } as const;
const SECURITY_PORT = { ssl: 465, starttls: 587, none: 25 } as const;

/** Settings → Email (admins). Zoho Mail SMTP; the password is write-only. */
export function MailSettingsCard() {
  const { toast, me } = useCrm();
  const [v, setV] = useState<MailView | null>(null);
  const [password, setPassword] = useState("");
  const [tplKind, setTplKind] = useState<keyof typeof TPL_LABEL>("invoice");
  const [busy, setBusy] = useState<"save" | "test" | null>(null);
  const [testTo, setTestTo] = useState("");
  useEffect(() => { crmFetch<MailView>("/api/crm/settings/mail").then((r) => { setV(r); }).catch((e) => toast(errText(e), "err")); }, [toast]);
  useEffect(() => { if (me?.email) setTestTo((t) => t || me.email); }, [me]);
  if (!v) return <section className="card" id="email"><h2 style={{ margin: 0 }}>Email</h2><Empty>Loading…</Empty></section>;
  const set = (p: Partial<MailView>) => setV({ ...v, ...p });
  const preset = v.presets.find((p) => p.host === v.host)?.key ?? "custom";
  const save = async () => {
    setBusy("save");
    try {
      const r = await crmFetch<MailView>("/api/crm/settings/mail", { method: "PUT", body: { host: v.host, port: v.port, security: v.security, user: v.user, password: password || undefined,
        fromName: v.fromName, fromEmail: v.fromEmail, replyTo: v.replyTo, bccSender: v.bccSender, templates: v.templates } });
      setV(r); setPassword(""); toast("Email settings saved");
    } catch (e) { toast(errText(e), "err"); } finally { setBusy(null); }
  };
  const test = async () => {
    setBusy("test");
    try { const r = await crmFetch<{ to: string }>("/api/crm/settings/mail/test", { method: "POST", body: { to: testTo || undefined } }); toast(`Test email sent to ${r.to}. Check that inbox.`); }
    catch (e) { toast(errText(e), "err"); } finally { setBusy(null); }
  };
  const tpl = v.templates[tplKind];

  return (
    <section className="card stack" id="email" style={{ gridColumn: "1 / -1" }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2 style={{ margin: 0 }}>Email</h2>
        <span className={"badge " + (v.configured ? "ok" : "warn")}>{v.configured ? "set up" : "not set up"}</span>
      </div>
      <p className="muted" style={{ margin: 0, fontSize: 13 }}>
        Invoices, quotes and statements are sent from your Zoho mailbox with the PDF attached, and a copy lands in that mailbox&apos;s Sent folder via BCC.
        If the Zoho account has two-factor sign-in, create an <b>app-specific password</b> in Zoho (My Account → Security → App passwords) and use it here.
      </p>
      <div className="grid4">
        <Field label="Mail service">
          <select value={preset} onChange={(e) => { const p = v.presets.find((x) => x.key === e.target.value); if (p) set({ host: p.host, port: 465, security: "ssl" }); else set({ host: "" }); }}>
            {v.presets.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
            <option value="custom">Other SMTP server</option>
          </select>
        </Field>
        <Field label="SMTP server"><input value={v.host} onChange={(e) => set({ host: e.target.value.trim() })} placeholder="smtppro.zoho.com" /></Field>
        <Field label="Security">
          <select value={v.security} onChange={(e) => { const s = e.target.value as MailView["security"]; set({ security: s, port: SECURITY_PORT[s] }); }}>
            <option value="ssl">SSL (port 465)</option><option value="starttls">STARTTLS (port 587)</option><option value="none">None (local test server only)</option>
          </select>
        </Field>
        <Field label="Port"><input type="number" min={1} max={65535} value={v.port} onChange={(e) => set({ port: Number(e.target.value) || 465 })} /></Field>
      </div>
      <div className="grid4">
        <Field label="Mailbox login" hint="Usually the full address."><input value={v.user} onChange={(e) => set({ user: e.target.value.trim(), fromEmail: v.fromEmail || e.target.value.trim() })} placeholder="info@auvetric.com" autoComplete="off" /></Field>
        <Field label="Password" hint={v.hasPassword ? "Saved. Leave blank to keep it." : "Stored encrypted; never shown again."}>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={v.hasPassword ? "••••••••" : ""} autoComplete="new-password" />
        </Field>
        <Field label="Sender name"><input value={v.fromName} onChange={(e) => set({ fromName: e.target.value })} /></Field>
        <Field label="Sender address" hint="Your mailbox or one of its Zoho aliases."><input value={v.fromEmail} onChange={(e) => set({ fromEmail: e.target.value.trim() })} /></Field>
      </div>
      <div className="grid4" style={{ alignItems: "end" }}>
        <Field label="Reply-to (optional)"><input value={v.replyTo} onChange={(e) => set({ replyTo: e.target.value.trim() })} placeholder="accounts@auvetric.com" /></Field>
        <label className="check"><input type="checkbox" checked={v.bccSender} onChange={(e) => set({ bccSender: e.target.checked })} /> BCC the sender (keeps a copy in the mailbox)</label>
      </div>

      <h3 style={{ margin: "6px 0 0", fontSize: 14 }}>Message templates</h3>
      <div className="tabs" role="tablist" aria-label="Template">
        {(Object.keys(TPL_LABEL) as (keyof typeof TPL_LABEL)[]).map((k) => <button key={k} role="tab" aria-selected={tplKind === k} className={tplKind === k ? "on" : ""} onClick={() => setTplKind(k)}>{TPL_LABEL[k]}</button>)}
      </div>
      <Field label="Subject"><input value={tpl.subject} onChange={(e) => set({ templates: { ...v.templates, [tplKind]: { ...tpl, subject: e.target.value } } })} /></Field>
      <Field label="Message" hint={<>Placeholders: {"{{contact}} {{client}} {{number}} {{total}} {{balance}} {{due_date}} {{period}} {{company}} {{sender}}"}. You can still edit each message before it goes.</>}>
        <textarea rows={8} value={tpl.body} onChange={(e) => set({ templates: { ...v.templates, [tplKind]: { ...tpl, body: e.target.value } } })} />
      </Field>

      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <button className="primary" disabled={busy !== null} onClick={save}><Save /> {busy === "save" ? "Saving…" : "Save email settings"}</button>
        <div className="grow" />
        <input value={testTo} onChange={(e) => setTestTo(e.target.value)} aria-label="Send the test email to" style={{ maxWidth: 260 }} />
        <button disabled={busy !== null || !v.configured} onClick={test} title={v.configured ? "" : "Save the settings first"}><Send /> {busy === "test" ? "Sending…" : "Send test email"}</button>
      </div>
    </section>
  );
}

type Backup = { id: string; kind: string; size: number; counts: Record<string, number>; created_at: string; created_by_name: string | null };

/** Settings → Backups (admins): nightly + manual backups in Netlify Blobs. */
export function BackupsCard() {
  const { toast } = useCrm();
  const [d, setD] = useState<{ storage: string; backups: Backup[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => crmFetch<{ storage: string; backups: Backup[] }>("/api/crm/backups").then(setD).catch((e) => toast(errText(e), "err")), [toast]);
  useEffect(() => { load(); }, [load]);
  const now = async () => {
    setBusy(true);
    try { const r = await crmFetch<{ size: number }>("/api/crm/backups", { method: "POST", body: {} }); toast(`Backup stored (${fmtSize(r.size)})`); load(); }
    catch (e) { toast(errText(e), "err"); } finally { setBusy(false); }
  };
  const last = d?.backups.find((b) => b.kind === "nightly");
  const stale = last ? Date.now() - Date.parse(last.created_at) > 36 * 3600e3 : true;
  return (
    <section className="card stack" id="backups" style={{ gridColumn: "1 / -1" }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2 style={{ margin: 0 }}>Backups</h2>
        {d && <span className="dim" style={{ fontSize: 12 }}>Storage: {d.storage === "netlify-blobs" ? "Netlify Blobs" : d.storage === "folder" ? "local folder (development)" : "not available"}</span>}
      </div>
      <p className="muted" style={{ margin: 0, fontSize: 13 }}>
        A full backup is taken every night at 06:00 with the daily job and kept for 35 days, plus one per month for a year. Backups hold every record but no passwords or 2FA secrets,
        and not the attached files themselves. To restore, see the runbook (<span className="mono">npm run crm:restore</span>).
      </p>
      {d && stale && d.storage !== "folder" && <div className="warn-box">{last ? "The last nightly backup is more than a day old." : "No nightly backup yet. The first one runs at 06:00 after this version goes live."} You can take one now.</div>}
      <div className="row"><button disabled={busy || d?.storage === "unavailable"} onClick={now}><DatabaseBackup /> {busy ? "Backing up…" : "Back up now"}</button></div>
      {!d ? <Empty>Loading…</Empty> : !d.backups.length ? <div className="dim" style={{ fontSize: 13 }}>No backups yet.</div> : (
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>Taken</th><th>Type</th><th className="r">Size</th><th className="r">Clients</th><th className="r">Documents</th><th className="r">Payments</th><th><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>{d.backups.slice(0, 40).map((b) => (
            <tr key={b.id}>
              <td className="nowrap">{new Date(b.created_at).toLocaleString("en-NA", { timeZone: "Africa/Windhoek", dateStyle: "medium", timeStyle: "short" })}</td>
              <td>{b.kind === "nightly" ? "Nightly" : `Manual${b.created_by_name ? ` · ${b.created_by_name.split(" ")[0]}` : ""}`}</td>
              <td className="r tabular">{fmtSize(b.size)}</td>
              <td className="r tabular">{b.counts.clients ?? "—"}</td><td className="r tabular">{b.counts.documents ?? "—"}</td><td className="r tabular">{b.counts.payments ?? "—"}</td>
              <td className="r"><a className="btn ghost icon sm" href={`/api/crm/backups/${b.id}/download`} aria-label="Download backup"><Download /></a></td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
    </section>
  );
}
