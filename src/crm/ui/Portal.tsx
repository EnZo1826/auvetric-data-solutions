"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, LogOut, Mail, Send, Upload, X } from "lucide-react";
import { formatMoney, todayISO } from "@/crm/shared/calc";

async function post<T = unknown>(path: string, body: unknown): Promise<T> {
  const form = body instanceof FormData;
  const res = await fetch(path, { method: "POST", credentials: "same-origin", cache: "no-store",
    headers: form ? undefined : { "Content-Type": "application/json" }, body: form ? body : JSON.stringify(body) }).catch(() => null);
  if (!res) throw new Error("Can't reach the server. Check your connection and try again.");
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status}).`);
  return data as T;
}

export function PortalLogin({ initialEmail = "" }: { initialEmail?: string }) {
  const [email, setEmail] = useState(initialEmail);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try { await post("/api/portal/login", { email }); setSent(true); } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  };
  if (sent) return (
    <div className="stack" role="status">
      <h1 style={{ margin: 0, fontSize: 22 }}>Check your inbox</h1>
      <p className="muted" style={{ margin: 0 }}>If <b>{email}</b> has access to the Auvetric client portal, we&apos;ve emailed it a sign-in link. The link works once and expires in 15 minutes.</p>
      <p className="dim" style={{ margin: 0, fontSize: 13 }}>Nothing arrived? Check spam, or use the address we send your invoices to. <button type="button" className="ghost sm" onClick={() => setSent(false)}>Try again</button></p>
    </div>
  );
  return (
    <form className="stack" onSubmit={submit} noValidate>
      <h1 style={{ margin: 0, fontSize: 22 }}>Client portal</h1>
      <p className="muted" style={{ margin: 0 }}>View your quotations, invoices and statement, accept quotes and let us know about payments. Enter your email address and we&apos;ll send you a sign-in link; no password needed.</p>
      <label className="field"><span>Email address</span><input type="email" autoComplete="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      {err && <div className="warn-box" role="alert">{err}</div>}
      <button className="primary" disabled={busy || !email.includes("@")}><Mail /> {busy ? "Sending…" : "Email me a sign-in link"}</button>
    </form>
  );
}

export function PortalVerify({ token }: { token: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const go = async () => {
    setBusy(true); setErr(null);
    try { await post("/api/portal/verify", { token }); router.replace("/portal"); router.refresh(); } catch (x) { setErr((x as Error).message); setBusy(false); }
  };
  return (
    <div className="stack">
      <h1 style={{ margin: 0, fontSize: 22 }}>Sign in to the client portal</h1>
      <p className="muted" style={{ margin: 0 }}>Press the button to finish signing in on this device.</p>
      {err ? <><div className="warn-box" role="alert">{err}</div><Link className="btn" href="/portal/login">Request a new link</Link></>
        : <button className="primary" autoFocus disabled={busy || !token} onClick={go}><Check /> {busy ? "Signing in…" : "Sign in"}</button>}
    </div>
  );
}

export function PortalSignOut() {
  const out = async () => { await post("/api/portal/logout", {}).catch(() => {}); window.location.assign("/portal/login"); };
  return <button className="ghost sm" onClick={out}><LogOut aria-hidden /> Sign out</button>;
}

export function QuoteDecision({ docId, number, total }: { docId: string; number: string; total: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"accept" | "decline" | null>(null);
  const [name, setName] = useState("");
  const [agree, setAgree] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const send = async () => {
    setBusy(true); setErr(null);
    try {
      if (mode === "accept") await post(`/api/portal/quotes/${docId}/accept`, { name, accept: agree });
      else await post(`/api/portal/quotes/${docId}/decline`, { reason });
      router.refresh();
    } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  };
  return (
    <section className="card stack" aria-label="Respond to this quotation">
      <h2 style={{ margin: 0 }}>Your response</h2>
      {!mode && <div className="row" style={{ gap: 8 }}>
        <button className="primary" onClick={() => setMode("accept")}><Check /> Accept quotation</button>
        <button className="ghost" onClick={() => setMode("decline")}><X /> Decline</button>
      </div>}
      {mode === "accept" && <>
        <label className="field"><span>Your full name</span><input value={name} autoFocus autoComplete="name" onChange={(e) => setName(e.target.value)} /></label>
        <label className="check" style={{ alignItems: "flex-start" }}>
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
          <span>I accept quotation <b>{number}</b> for <b>{total}</b> on behalf of my organisation, including its terms.</span>
        </label>
        <p className="dim" style={{ margin: 0, fontSize: 12 }}>We record your name, email address, the time and your IP address as your electronic acceptance.</p>
        <div className="row" style={{ gap: 8 }}>
          <button className="primary" disabled={busy || name.trim().length < 2 || !agree} onClick={send}><Check /> {busy ? "Sending…" : "Accept"}</button>
          <button className="ghost" onClick={() => setMode(null)}>Back</button>
        </div>
      </>}
      {mode === "decline" && <>
        <label className="field"><span>Anything we should know? (optional)</span><textarea rows={3} value={reason} autoFocus onChange={(e) => setReason(e.target.value)} placeholder="e.g. timing, budget, scope" /></label>
        <div className="row" style={{ gap: 8 }}>
          <button className="danger" disabled={busy} onClick={send}>{busy ? "Sending…" : "Decline quotation"}</button>
          <button className="ghost" onClick={() => setMode(null)}>Back</button>
        </div>
      </>}
      {err && <div className="warn-box" role="alert">{err}</div>}
    </section>
  );
}

export function PayPanel({ docId, number, balance, currency, bank }: { docId: string; number: string; balance: number; currency: string; bank: string[] }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ amount: String(balance), date: todayISO(), reference: number, note: "" });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const send = async () => {
    setBusy(true); setErr(null);
    try {
      if (file && file.size > 4 * 1024 * 1024) throw new Error("The file is larger than 4 MB.");
      const fd = new FormData();
      Object.entries(f).forEach(([k, v]) => fd.set(k, v));
      if (file) fd.set("file", file);
      await post(`/api/portal/invoices/${docId}/proof`, fd);
      setDone(true);
    } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  };
  return (
    <section className="card stack" aria-label="Pay this invoice">
      <h2 style={{ margin: 0 }}>Pay by EFT</h2>
      <div style={{ fontSize: 14 }}>Amount due: <b>{formatMoney(balance, currency)}</b></div>
      <div className="pre" style={{ fontSize: 13, lineHeight: 1.6 }}>{bank.join("\n")}{"\n"}Reference: <b>{number}</b></div>
      {done ? <div className="ok-box" role="status">Thank you. We&apos;ve received your payment notice and will confirm once it reflects in our account.</div>
        : !open ? <button className="primary" onClick={() => setOpen(true)}><Send /> I&apos;ve paid: send proof of payment</button>
        : <>
          <div className="grid3">
            <label className="field"><span>Amount paid ({currency})</span><input type="number" min={0} step="0.01" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></label>
            <label className="field"><span>Payment date</span><input type="date" max={todayISO()} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></label>
            <label className="field"><span>Your reference</span><input value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} /></label>
          </div>
          <label className="field"><span>Proof of payment (PDF or image, max 4 MB)</span><input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
          <label className="field"><span>Note (optional)</span><textarea rows={2} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></label>
          {err && <div className="warn-box" role="alert">{err}</div>}
          <div className="row" style={{ gap: 8 }}>
            <button className="primary" disabled={busy || !(Number(f.amount) > 0)} onClick={send}><Upload /> {busy ? "Sending…" : "Send"}</button>
            <button className="ghost" onClick={() => setOpen(false)}>Cancel</button>
          </div>
        </>}
    </section>
  );
}
