import { NextResponse, type NextRequest } from "next/server";
import { enquirySchema, INTENTS, type Enquiry } from "@/lib/contact-schema";

export const runtime = "nodejs";

/**
 * Project enquiry endpoint.
 * Delivery provider is chosen by CONTACT_PROVIDER ("resend" | "webhook").
 * Success is returned ONLY after the provider confirms acceptance.
 */

// ── Rate limiting (per instance, in-memory). Use a shared store (e.g. Upstash) on multi-instance/serverless hosts.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const hits = new Map<string, number[]>();
function rateLimited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) for (const [k, v] of hits) if (now - v[v.length - 1] > WINDOW_MS) hits.delete(k);
  return recent.length > MAX_PER_WINDOW;
}

function clientIp(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

async function verifyTurnstile(token: string | null, ip: string) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true; // not configured
  if (!token) return false;
  const body = new URLSearchParams({ secret, response: token, remoteip: ip });
  const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body, signal: AbortSignal.timeout(8000) });
  const j = (await r.json().catch(() => ({}))) as { success?: boolean };
  return j.success === true;
}

function render(e: Enquiry) {
  return [
    `Intent: ${INTENTS[e.intent]}`,
    `Name: ${e.name}`,
    `Organisation: ${e.organisation || "—"}`,
    `Email: ${e.email}`,
    `Phone: ${e.phone || "—"}`,
    `Area of interest: ${e.interest}`,
    `Budget: ${e.budget}`,
    `Timeline: ${e.timeline}`,
    "",
    "Project description:",
    e.description,
  ].join("\n");
}

async function deliver(e: Enquiry): Promise<{ ok: true; ref?: string } | { ok: false; status: number; error: string }> {
  const provider = process.env.CONTACT_PROVIDER;
  const subject = `[${INTENTS[e.intent]}] ${e.name}${e.organisation ? ` — ${e.organisation}` : ""}`;

  if (provider === "resend") {
    const key = process.env.RESEND_API_KEY, to = process.env.CONTACT_TO_EMAIL, from = process.env.CONTACT_FROM_EMAIL;
    if (!key || !to || !from) return { ok: false, status: 503, error: "Enquiry delivery is not fully configured." };
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: to.split(",").map((s) => s.trim()), reply_to: e.email, subject, text: render(e) }),
      signal: AbortSignal.timeout(10000),
    });
    const j = (await r.json().catch(() => ({}))) as { id?: string };
    if (!r.ok || !j.id) return { ok: false, status: 502, error: "The mail provider did not accept the message." };
    return { ok: true, ref: j.id };
  }

  if (provider === "webhook") {
    const url = process.env.CONTACT_WEBHOOK_URL;
    if (!url) return { ok: false, status: 503, error: "Enquiry delivery is not fully configured." };
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (process.env.CONTACT_WEBHOOK_SECRET) headers["X-Webhook-Secret"] = process.env.CONTACT_WEBHOOK_SECRET;
    const r = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ subject, text: render(e), enquiry: e, receivedAt: new Date().toISOString() }),
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) return { ok: false, status: 502, error: "The enquiry service did not accept the message." };
    return { ok: true };
  }

  return { ok: false, status: 503, error: "Online enquiries are not yet enabled." };
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  // Block cross-origin browser submissions. Server-to-server requests may omit Origin.
  const allowedOrigin = new URL(process.env.NEXT_PUBLIC_SITE_URL || req.url).origin;
  if (origin && origin !== allowedOrigin) return NextResponse.json({ error: "Origin not allowed." }, { status: 403 });
  const length = Number(req.headers.get("content-length") || 0);
  if (length > 32768) return NextResponse.json({ error: "Submission too large." }, { status: 413 });
  const ip = clientIp(req);
  if (rateLimited(ip)) return NextResponse.json({ error: "Too many submissions. Please try again in a few minutes." }, { status: 429 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid submission." }, { status: 400 });
  }

  // Honeypot + timing trap
  if (String(form.get("website") ?? "") !== "") return NextResponse.json({ error: "Submission rejected." }, { status: 400 });
  const started = Number(form.get("started") ?? 0);
  const elapsed = Date.now() - started;
  if (!started || elapsed < 3000 || elapsed > 6 * 60 * 60 * 1000) {
    return NextResponse.json({ error: "Please take a moment to complete the form, then submit again." }, { status: 400 });
  }

  try {
    if (!(await verifyTurnstile(form.get("cf-turnstile-response") as string | null, ip))) {
      return NextResponse.json({ error: "Verification failed. Please complete the challenge and try again." }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Verification service unavailable. Please try again shortly." }, { status: 503 });
  }

  const parsed = enquirySchema.safeParse(Object.fromEntries(form.entries()));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = String(issue.path[0] ?? "form");
      if (!fieldErrors[k]) fieldErrors[k] = issue.message;
    }
    return NextResponse.json({ error: "Please correct the highlighted fields.", fieldErrors }, { status: 422 });
  }

  try {
    const res = await deliver(parsed.data);
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
    return NextResponse.json({ ok: true, ref: res.ref ?? null });
  } catch (err) {
    console.error("[contact] delivery failed", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "We could not deliver your enquiry right now. Please try again shortly." }, { status: 502 });
  }
}
