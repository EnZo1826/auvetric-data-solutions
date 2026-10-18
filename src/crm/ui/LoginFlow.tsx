"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { crmFetch } from "./api";

type Step = "login" | "password" | "enroll" | "mfa";
type Next = "password" | "enroll" | "mfa" | "done";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

export function LoginFlow({ initial, email: initialEmail }: { initial: Step; email: string }) {
  const [step, setStep] = useState<Step>(initial);
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const go = useCallback((next: Next) => {
    setError(null);
    if (next === "done") window.location.assign("/crm");
    else setStep(next);
  }, []);

  const submit = async (path: string, body: unknown) => {
    setBusy(true);
    setError(null);
    try {
      const r = await crmFetch<{ next: Next }>(path, { method: "POST", body });
      go(r.next);
    } catch (e) {
      const err = e as Error & { restart?: boolean };
      setError(err.message);
      if (err.restart) setStep("login");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <div className="auth-card">
        <div className="lock">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${basePath}/brand/auvetric-lockup-dark.png`} alt="Auvetric Data Solutions" width={480} height={112} />
        </div>
        <div className="card stack" aria-live="polite">
          {step === "login" && <PasswordStep busy={busy} email={email} setEmail={setEmail} onSubmit={(pw) => submit("/api/crm/auth/login", { email, password: pw })} />}
          {step === "password" && <NewPasswordStep busy={busy} onSubmit={(pw) => submit("/api/crm/auth/password", { newPassword: pw })} />}
          {step === "enroll" && <EnrollStep busy={busy} onSubmit={(code) => submit("/api/crm/auth/enroll", { code })} onFatal={(m) => { setError(m); setStep("login"); }} />}
          {step === "mfa" && <CodeStep busy={busy} onSubmit={(code) => submit("/api/crm/auth/verify", { code })} />}
          {error && <div className="err-box" role="alert">{error}</div>}
          {step !== "login" && (
            <button type="button" className="ghost sm" onClick={async () => { await crmFetch("/api/crm/auth/logout", { method: "POST", body: {} }).catch(() => {}); setError(null); setStep("login"); }}>
              Start again
            </button>
          )}
        </div>
        <p className="dim" style={{ textAlign: "center", fontSize: 12, marginTop: 16 }}>
          Partner access only · <Link href="/">auvetric.com</Link>
        </p>
      </div>
    </div>
  );
}

function PasswordStep({ busy, email, setEmail, onSubmit }: { busy: boolean; email: string; setEmail: (v: string) => void; onSubmit: (pw: string) => void }) {
  const [pw, setPw] = useState("");
  return (
    <form className="stack" onSubmit={(e) => { e.preventDefault(); onSubmit(pw); }}>
      <div>
        <div className="step">Partner sign-in</div>
        <h1>Auvetric CRM</h1>
      </div>
      <label className="field"><span>Email</span>
        <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} autoFocus={!email} />
      </label>
      <label className="field"><span>Password</span>
        <input type="password" autoComplete="current-password" required value={pw} onChange={(e) => setPw(e.target.value)} autoFocus={!!email} />
      </label>
      <button className="primary" disabled={busy || !email || !pw}>{busy ? "Checking…" : "Continue"}</button>
    </form>
  );
}

function NewPasswordStep({ busy, onSubmit }: { busy: boolean; onSubmit: (pw: string) => void }) {
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const mismatch = b.length > 0 && a !== b;
  return (
    <form className="stack" onSubmit={(e) => { e.preventDefault(); if (!mismatch) onSubmit(a); }}>
      <div>
        <div className="step">Step 2 · New password</div>
        <h1>Choose your password</h1>
        <p className="muted" style={{ marginTop: 6 }}>Replace the one-time password. Use at least 12 characters; a passphrase of four or more words works well.</p>
      </div>
      <label className="field"><span>New password</span>
        <input type="password" autoComplete="new-password" minLength={12} required value={a} onChange={(e) => setA(e.target.value)} autoFocus />
      </label>
      <label className="field"><span>Repeat new password</span>
        <input type="password" autoComplete="new-password" required value={b} onChange={(e) => setB(e.target.value)} aria-invalid={mismatch} />
      </label>
      {mismatch && <div className="err-box">The passwords don&apos;t match.</div>}
      <button className="primary" disabled={busy || a.length < 12 || a !== b}>{busy ? "Saving…" : "Save password"}</button>
    </form>
  );
}

function CodeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <input ref={ref} className="code-input" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6}
      placeholder="000000" aria-label="6-digit code" value={value} onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))} />
  );
}

function CodeStep({ busy, onSubmit }: { busy: boolean; onSubmit: (code: string) => void }) {
  const [code, setCode] = useState("");
  return (
    <form className="stack" onSubmit={(e) => { e.preventDefault(); onSubmit(code); setCode(""); }}>
      <div>
        <div className="step">Two-factor</div>
        <h1>Enter your code</h1>
        <p className="muted" style={{ marginTop: 6 }}>Open your authenticator app and enter the 6-digit code for Auvetric CRM.</p>
      </div>
      <CodeInput value={code} onChange={setCode} />
      <button className="primary" disabled={busy || code.length !== 6}>{busy ? "Verifying…" : "Sign in"}</button>
    </form>
  );
}

function EnrollStep({ busy, onSubmit, onFatal }: { busy: boolean; onSubmit: (code: string) => void; onFatal: (msg: string) => void }) {
  const [data, setData] = useState<{ qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  useEffect(() => {
    crmFetch<{ qr: string; secret: string }>("/api/crm/auth/enroll").then(setData).catch((e: Error) => onFatal(e.message));
  }, [onFatal]);
  return (
    <form className="stack" onSubmit={(e) => { e.preventDefault(); onSubmit(code); setCode(""); }}>
      <div>
        <div className="step">Step 3 · Two-factor set-up</div>
        <h1>Link your authenticator</h1>
        <p className="muted" style={{ marginTop: 6 }}>Scan this with Google Authenticator, Microsoft Authenticator, 1Password or similar, then enter the code it shows.</p>
      </div>
      {data ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <div className="qr"><img src={data.qr} alt="QR code for your authenticator app" width={200} height={200} /></div>
          <details>
            <summary className="muted" style={{ cursor: "pointer", fontSize: 12 }}>Can&apos;t scan? Enter this key instead</summary>
            <div className="secret" style={{ marginTop: 8 }}>{data.secret}</div>
          </details>
        </>
      ) : (
        <div className="empty">Preparing…</div>
      )}
      <CodeInput value={code} onChange={setCode} />
      <button className="primary" disabled={busy || !data || code.length !== 6}>{busy ? "Verifying…" : "Confirm and sign in"}</button>
    </form>
  );
}
