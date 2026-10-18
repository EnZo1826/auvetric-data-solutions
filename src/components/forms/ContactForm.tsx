"use client";

import Link from "next/link";
import { Turnstile } from "./Turnstile";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { BUDGETS, INTENTS, INTERESTS, TIMELINES, enquirySchema, type Intent } from "@/lib/contact-schema";
import { RELAY_URL, buildRelayBody } from "@/lib/relay";
import { cx } from "@/components/ui/primitives";

type Status = { kind: "idle" } | { kind: "sending" } | { kind: "sent"; ref: string | null } | { kind: "error"; message: string };

const TURNSTILE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const FALLBACK_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL;

const field = "mt-1.5 block min-h-11 w-full rounded-xl border bg-base px-3.5 py-2.5 text-[0.95rem] text-ink placeholder:text-dim focus:outline-none focus:ring-2 focus:ring-data/40";

/** Static hosting: deliver via the Web3Forms relay (email → n8n). Server hosting: POST to /api/contact. */
async function sendViaRelay(fd: FormData, intent: Intent, started: number, relayKey: string) {
  if (Date.now() - started < 3000) return { ok: false as const, error: "Please take a moment to complete the form, then submit again." };
  const parsed = enquirySchema.safeParse({ ...Object.fromEntries(fd.entries()), intent });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) { const k = String(i.path[0] ?? "form"); if (!fieldErrors[k]) fieldErrors[k] = i.message; }
    return { ok: false as const, error: "Please correct the highlighted fields.", fieldErrors };
  }
  const e = parsed.data;
  const body = buildRelayBody(
    { intent: e.intent, name: e.name, organisation: e.organisation, email: e.email, phone: e.phone, interest: e.interest, description: e.description, budget: e.budget, timeline: e.timeline },
    { accessKey: relayKey, intentLabel: INTENTS[e.intent], submissionId: crypto.randomUUID(), botcheck: String(fd.get("website") ?? "") !== "" },
  );
  const r = await fetch(RELAY_URL, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(body) });
  const j = (await r.json().catch(() => ({}))) as { success?: boolean; message?: string };
  // Success only when the relay confirms it accepted the message.
  if (r.ok && j.success === true) return { ok: true as const, ref: null };
  return { ok: false as const, error: r.status === 429 ? "Too many submissions. Please try again in a few minutes." : `The enquiry could not be sent (${j.message ?? `HTTP ${r.status}`}).` };
}

export function ContactForm({ initialIntent = "project", initialInterest = "", relayKey }: { initialIntent?: Intent; initialInterest?: string; relayKey?: string }) {
  const [intent, setIntent] = useState<Intent>(initialIntent);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [started, setStarted] = useState(0);
  const [captchaAttempt, setCaptchaAttempt] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);

  useEffect(() => setStarted(Date.now()), []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    setStatus({ kind: "sending" });
    const fd = new FormData(e.currentTarget);
    fd.set("intent", intent);
    fd.set("started", String(started));
    try {
      let r: { ok: boolean }, j: { ok?: boolean; ref?: string | null; error?: string; fieldErrors?: Record<string, string> };
      if (relayKey) {
        const res = await sendViaRelay(fd, intent, started, relayKey);
        r = { ok: res.ok }; j = res;
      } else {
        const res = await fetch("/api/contact", { method: "POST", body: fd });
        r = res; j = (await res.json().catch(() => ({}))) as typeof j;
        if (!res.ok && !j.error) j.error = `The enquiry could not be sent (HTTP ${res.status}).`;
      }
      if (r.ok && j.ok) {
        setStatus({ kind: "sent", ref: j.ref ?? null });
        formRef.current?.reset();
      } else {
        if (j.fieldErrors) setErrors(j.fieldErrors);
        setStatus({ kind: "error", message: j.error ?? "The enquiry could not be sent." });
        const first = j.fieldErrors && Object.keys(j.fieldErrors)[0];
        if (first) (formRef.current?.elements.namedItem(first) as HTMLElement | null)?.focus();
      }
    } catch {
      setStatus({ kind: "error", message: "Network error — your enquiry was not sent. Please check your connection and try again." });
    } finally {
      // A token may have been consumed even when delivery failed or the response was lost.
      setCaptchaAttempt((attempt) => attempt + 1);
    }
    requestAnimationFrame(() => statusRef.current?.focus());
  }

  const err = (k: string) => errors[k] && <p id={`${k}-err`} className="mt-1.5 text-sm text-danger">{errors[k]}</p>;
  const border = (k: string) => (errors[k] ? "border-danger/70" : "border-line-strong");
  const describe = (k: string) => (errors[k] ? `${k}-err` : undefined);

  if (status.kind === "sent")
    return (
      <div ref={statusRef} tabIndex={-1} role="status" className="rise-in rounded-3xl border border-ok/40 bg-ok/[0.05] p-8 outline-none">
        <CheckCircle2 className="size-8 text-ok" aria-hidden />
        <h2 className="mt-4 font-display text-2xl text-ink">Enquiry received.</h2>
        <p className="mt-2 max-w-[55ch] text-mute">Thank you — your message was accepted by our enquiry service{status.ref ? ` (reference ${status.ref})` : ""}. We will reply to the email address you provided.</p>
        <button type="button" onClick={() => { setStatus({ kind: "idle" }); setStarted(Date.now()); }} className="mt-6 text-sm text-ink underline">Send another enquiry</button>
      </div>
    );

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="space-y-6" aria-describedby="form-status">

      <fieldset>
        <legend className="text-sm text-ink">How can we help?</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {(Object.keys(INTENTS) as Intent[]).map((k) => (
            <label key={k} className={cx("flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-4 text-sm transition-colors", intent === k ? "border-data/60 bg-data/[0.07] text-ink" : "border-line text-mute hover:text-ink")}>
              <input type="radio" name="intent-choice" value={k} checked={intent === k} onChange={() => setIntent(k)} className="accent-[#00d4ea]" />
              {INTENTS[k]}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block text-sm text-ink">Name <span className="text-dim">(required)</span>
          <input name="name" autoComplete="name" required className={cx(field, border("name"))} aria-invalid={!!errors.name} aria-describedby={describe("name")} />
          {err("name")}
        </label>
        <label className="block text-sm text-ink">Organisation
          <input name="organisation" autoComplete="organization" className={cx(field, border("organisation"))} />
        </label>
        <label className="block text-sm text-ink">Email <span className="text-dim">(required)</span>
          <input name="email" type="email" autoComplete="email" required className={cx(field, border("email"))} aria-invalid={!!errors.email} aria-describedby={describe("email")} />
          {err("email")}
        </label>
        <label className="block text-sm text-ink">Phone <span className="text-dim">(optional)</span>
          <input name="phone" type="tel" autoComplete="tel" className={cx(field, border("phone"))} aria-invalid={!!errors.phone} aria-describedby={describe("phone")} />
          {err("phone")}
        </label>
      </div>

      <label className="block text-sm text-ink">Area of interest <span className="text-dim">(required)</span>
        <select name="interest" required defaultValue={initialInterest} className={cx(field, border("interest"))} aria-invalid={!!errors.interest} aria-describedby={describe("interest")}>
          <option value="" disabled>Choose one…</option>
          {INTERESTS.map((i) => <option key={i}>{i}</option>)}
        </select>
        {err("interest")}
      </label>

      <label className="block text-sm text-ink">Project description <span className="text-dim">(required)</span>
        <textarea name="description" rows={6} required placeholder="What problem are you trying to solve? Which systems, sites or data are involved?" className={cx(field, "min-h-36", border("description"))} aria-invalid={!!errors.description} aria-describedby={describe("description")} />
        {err("description")}
      </label>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block text-sm text-ink">Budget range <span className="text-dim">(optional)</span>
          <select name="budget" defaultValue="Not specified" className={cx(field, "border-line-strong")}>{BUDGETS.map((b) => <option key={b}>{b}</option>)}</select>
        </label>
        <label className="block text-sm text-ink">Target timeline <span className="text-dim">(optional)</span>
          <select name="timeline" defaultValue="Not specified" className={cx(field, "border-line-strong")}>{TIMELINES.map((b) => <option key={b}>{b}</option>)}</select>
        </label>
      </div>

      {/* Honeypot — hidden from people and assistive tech */}
      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>

      <label className="flex items-start gap-3 text-sm text-mute">
        <input type="checkbox" name="consent" className="mt-1 size-4 accent-[#00d4ea]" aria-invalid={!!errors.consent} aria-describedby={describe("consent")} />
        <span>I agree that the details I provide may be used to respond to this enquiry, as described in the <Link href="/privacy" className="text-ink underline">privacy notice</Link>. We do not add you to marketing lists.</span>
      </label>
      {err("consent")}

      {TURNSTILE_KEY && !relayKey && <Turnstile key={captchaAttempt} siteKey={TURNSTILE_KEY} />}

      <div id="form-status" ref={statusRef} tabIndex={-1} role={status.kind === "error" ? "alert" : "status"} className="outline-none">
        {status.kind === "error" && (
          <div className="rounded-xl border border-danger/50 bg-danger/[0.07] p-4 text-sm text-ink">
            <p>{status.message}</p>
            {FALLBACK_EMAIL && <p className="mt-1 text-mute">You can also email us directly at <a className="text-ink underline" href={`mailto:${FALLBACK_EMAIL}`}>{FALLBACK_EMAIL}</a>.</p>}
          </div>
        )}
      </div>

      <button type="submit" disabled={status.kind === "sending" || !started} className="inline-flex min-h-12 items-center gap-2 rounded-full bg-ink px-7 font-medium text-void transition-colors hover:bg-white disabled:cursor-wait disabled:opacity-60">
        {status.kind === "sending" && <Loader2 className="size-4 animate-spin" aria-hidden />}
        {status.kind === "sending" ? "Sending…" : `Send — ${INTENTS[intent]}`}
      </button>
    </form>
  );
}
