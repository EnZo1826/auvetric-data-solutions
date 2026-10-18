"use client";

import { useState } from "react";
import { crmFetch } from "./api";

export function AccountForms({ email }: { email: string }) {
  const [cur, setCur] = useState("");
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const change = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await crmFetch("/api/crm/auth/password", { method: "POST", body: { currentPassword: cur, newPassword: a } });
      setCur(""); setA(""); setB("");
      setMsg({ ok: true, text: "Password changed. Other devices have been signed out." });
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const everywhere = async () => {
    if (!window.confirm("Sign out of every device, including this one?")) return;
    await crmFetch("/api/crm/auth/logout", { method: "POST", body: { everywhere: true } }).catch(() => {});
    window.location.assign("/crm/login");
  };

  return (
    <div className="stack">
      <form className="card stack" onSubmit={change}>
        <h2 style={{ margin: 0 }}>Change password</h2>
        <input type="email" autoComplete="username" value={email} readOnly hidden />
        <label className="field"><span>Current password</span>
          <input type="password" autoComplete="current-password" required value={cur} onChange={(e) => setCur(e.target.value)} />
        </label>
        <label className="field"><span>New password (12+ characters)</span>
          <input type="password" autoComplete="new-password" minLength={12} required value={a} onChange={(e) => setA(e.target.value)} />
        </label>
        <label className="field"><span>Repeat new password</span>
          <input type="password" autoComplete="new-password" required value={b} onChange={(e) => setB(e.target.value)} />
        </label>
        {b && a !== b && <div className="err-box">The passwords don&apos;t match.</div>}
        {msg && <div className={msg.ok ? "ok-box" : "err-box"} role="status">{msg.text}</div>}
        <div className="row"><button className="primary" disabled={busy || !cur || a.length < 12 || a !== b}>{busy ? "Saving…" : "Change password"}</button></div>
      </form>
      <section className="card stack">
        <h2 style={{ margin: 0 }}>Security</h2>
        <p className="muted" style={{ margin: 0 }}>Two-factor sign-in is required for all partners. Lost your phone? The other partner can reset your two-factor with <span className="mono">npm run crm:user -- reset-mfa {email}</span>.</p>
        <div className="row"><button className="danger" onClick={everywhere}>Sign out everywhere</button></div>
      </section>
    </div>
  );
}
