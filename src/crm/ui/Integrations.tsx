"use client";

import { useCallback, useEffect, useState } from "react";
import { KeyRound, Plus, RefreshCw } from "lucide-react";
import { crmFetch } from "./api";
import { errText, useCrm } from "./store";
import { confirmAction, Empty, Field, Modal, PageHead } from "./ui";

type Token = { id: string; name: string; prefix: string; last_used_at: string | null; last_used_ip: string | null; revoked_at: string | null; created_at: string; created_by_name: string | null };
type Status = {
  tokens: Token[];
  enquiries: { pending: number; claimed: number; failed: number; last_triaged: string | null; last_received: string | null; oldest_waiting: string | null };
  opportunities: { total: number; last24: number; last_ingest: string | null };
};

const when = (iso: string | null) => (iso ? new Intl.DateTimeFormat("en-NA", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Windhoek" }).format(new Date(iso)) : "never");
const ago = (iso: string | null) => {
  if (!iso) return null;
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  return m < 60 ? `${m} min ago` : m < 2880 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} days ago`;
};

export function IntegrationsScreen() {
  const { me, toast } = useCrm();
  const [s, setS] = useState<Status | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("n8n on Jakes's PC");
  const [shown, setShown] = useState<{ name: string; token: string } | null>(null);
  const admin = me?.role === "admin";
  const load = useCallback(() => crmFetch<Status>("/api/crm/integrations").then(setS).catch((e) => toast(errText(e), "err")), [toast]);
  useEffect(() => { if (admin) load(); }, [load, admin]);

  if (!admin) return <><PageHead title="Integrations" /><Empty>Only admins can manage integrations.</Empty></>;
  if (!s) return <><PageHead title="Integrations" /><Empty>Loading…</Empty></>;

  const create = async () => {
    try { const r = await crmFetch<{ name: string; token: string }>("/api/crm/integrations/tokens", { method: "POST", body: { name } }); setAdding(false); setShown(r); load(); } catch (e) { toast(errText(e), "err"); }
  };
  const revoke = async (t: Token) => {
    if (!confirmAction(`Revoke “${t.name}”? Anything using it stops syncing at once.`)) return;
    try { await crmFetch(`/api/crm/integrations/tokens/${t.id}`, { method: "DELETE" }); toast("Token revoked"); load(); } catch (e) { toast(errText(e), "err"); }
  };
  const live = s.tokens.filter((t) => !t.revoked_at);
  const lastUse = live.map((t) => t.last_used_at).filter(Boolean).sort().pop() ?? null;
  const stale = !lastUse || Date.now() - Date.parse(lastUse) > 30 * 60_000;
  const waiting = s.enquiries.pending + s.enquiries.claimed;

  return (
    <>
      <PageHead title="Integrations"><button onClick={load}><RefreshCw /> Refresh</button></PageHead>
      <div className="grid3" style={{ marginBottom: 12 }}>
        <div className="card kpi">
          <span className="l">n8n connection</span>
          <span className="v" style={{ fontSize: 16 }}>{!live.length ? <span className="badge err">no token</span> : stale ? <span className="badge warn">not seen recently</span> : <span className="badge ok">connected</span>}</span>
          <span className="s">Last call {ago(lastUse) ?? "never"}. n8n polls every 5 minutes while the PC is on.</span>
        </div>
        <div className="card kpi">
          <span className="l">Enquiries awaiting AI triage</span>
          <span className="v" style={waiting && stale ? { color: "var(--warn)" } : undefined}>{waiting}</span>
          <span className="s">{s.enquiries.oldest_waiting ? `Oldest ${ago(s.enquiries.oldest_waiting)}` : "None waiting"}{s.enquiries.failed ? ` · ${s.enquiries.failed} failed` : ""} · last triaged {ago(s.enquiries.last_triaged) ?? "never"}</span>
        </div>
        <div className="card kpi">
          <span className="l">Opportunities</span>
          <span className="v">{s.opportunities.total}</span>
          <span className="s">{s.opportunities.last24} in the last 24 h · last sync {ago(s.opportunities.last_ingest) ?? "never"}</span>
        </div>
      </div>

      <section className="card flush" style={{ marginBottom: 12 }}>
        <div className="row" style={{ padding: "14px 16px 4px", justifyContent: "space-between" }}>
          <h2 style={{ margin: 0 }}>Integration tokens</h2>
          <button className="sm" onClick={() => setAdding(true)}><Plus /> New token</button>
        </div>
        {!s.tokens.length ? <Empty>No tokens yet. Create one and paste it into n8n.</Empty> : (
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>Name</th><th>Token</th><th>Created</th><th>Last used</th><th /></tr></thead>
            <tbody>{s.tokens.map((t) => (
              <tr key={t.id} style={t.revoked_at ? { opacity: 0.5 } : undefined}>
                <td><KeyRound style={{ width: 14, height: 14, verticalAlign: -2, marginRight: 6 }} />{t.name}{t.revoked_at && <span className="badge" style={{ marginLeft: 6 }}>revoked</span>}</td>
                <td className="mono">{t.prefix}…</td>
                <td className="muted" style={{ fontSize: 12 }}>{when(t.created_at)}{t.created_by_name ? ` · ${t.created_by_name}` : ""}</td>
                <td className="muted" style={{ fontSize: 12 }}>{when(t.last_used_at)}{t.last_used_ip ? ` · ${t.last_used_ip}` : ""}</td>
                <td className="r">{!t.revoked_at && <button className="sm danger" onClick={() => revoke(t)}>Revoke</button>}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </section>

      <section className="card stack" style={{ gap: 6, maxWidth: 820 }}>
        <h2 style={{ margin: 0 }}>How the n8n link works</h2>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.6 }}>
          <li>Website enquiries are stored here straight away, even when the PC is off.</li>
          <li>n8n on the PC calls <span className="mono">/api/ingest</span> every 5 minutes. It claims enquiries awaiting triage, runs the local AI model, writes the summary back and emails both partners. It also pushes new Upwork and LinkedIn listings to Opportunities.</li>
          <li>The PC only makes outgoing calls. Nothing on it is reachable from the internet.</li>
          <li>Tokens are stored hashed and shown once. In n8n, open the credential <b>Auvetric CRM (ingest token)</b> and set the header value to <span className="mono">Bearer &lt;token&gt;</span>.</li>
        </ul>
      </section>

      {adding && (
        <Modal title="New integration token" onClose={() => setAdding(false)} footer={<><button onClick={() => setAdding(false)}>Cancel</button><button className="primary" disabled={!name.trim()} onClick={create}>Create</button></>}>
          <Field label="Name" hint="Where it will be used, so you know what breaks if you revoke it."><input autoFocus value={name} onChange={(e) => setName(e.target.value)} /></Field>
        </Modal>
      )}
      {shown && (
        <Modal title="Copy the token now" onClose={() => setShown(null)} footer={<button className="primary" onClick={() => setShown(null)}>I&apos;ve stored it</button>}>
          <div className="stack">
            <p style={{ margin: 0 }}>This is the only time the token for <b>{shown.name}</b> is shown. Paste it into n8n, then close this window.</p>
            <div className="secret">{shown.token}</div>
            <button onClick={async () => { try { await navigator.clipboard.writeText(shown.token); toast("Token copied"); } catch { toast("Select the token and copy it.", "err"); } }}>Copy</button>
          </div>
        </Modal>
      )}
    </>
  );
}
