/**
 * n8n ingest API (/api/ingest/*). Authenticated by an integration token (Authorization: Bearer auvi_…),
 * never by a session cookie, so it sits outside the /api/crm middleware gate.
 *   GET   /api/ingest/ping                     token check
 *   POST  /api/ingest/opportunities            { items: [...] } upsert by job_key (n8n-owned fields only)
 *   POST  /api/ingest/enquiries                { items: [...] } relay/backfill upsert by submission_id
 *   POST  /api/ingest/enquiries/claim          { limit } → enquiries awaiting AI triage (atomic claim)
 *   PATCH /api/ingest/enquiries/:id/triage     { ok, ai?, error? } → { alert } (false for spam)
 */
import { createHash, randomBytes } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "./db";
import { clientMeta, HttpError } from "./http";
import { claimForTriage, EnquiryAIZ, IncomingEnquiryZ, saveTriage, storeEnquiry } from "./enquiries";
import { normalisePractice } from "@/crm/shared/sales";

export const TOKEN_PREFIX = "auvi_";
export const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");
export function newToken() {
  const token = TOKEN_PREFIX + randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token), prefix: token.slice(0, 10) };
}

// Per-instance throttle on top of token auth: 240 requests per minute per token.
const hits = new Map<string, number[]>();
function throttle(key: string) {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(key, recent);
  if (recent.length > 240) throw new HttpError(429, "Rate limit exceeded.");
}

export async function authIngest(req: NextRequest) {
  const h = req.headers.get("authorization") ?? "";
  const m = h.match(/^Bearer\s+(auvi_[A-Za-z0-9_-]{30,80})$/);
  if (!m) throw new HttpError(401, "Missing or malformed integration token.");
  const [tok] = await db()`select id, name from integration_tokens where token_hash = ${hashToken(m[1])} and revoked_at is null`;
  if (!tok) throw new HttpError(401, "Invalid or revoked integration token.");
  throttle(tok.id);
  const ip = clientMeta(req).ip;
  // Touch at most once a minute to avoid a write per request.
  await db()`update integration_tokens set last_used_at = now(), last_used_ip = ${ip}
             where id = ${tok.id} and (last_used_at is null or last_used_at < now() - interval '1 minute')`;
  return { tokenId: tok.id as string, tokenName: tok.name as string, ip };
}

async function body<T>(req: NextRequest, schema: z.ZodType<T>, max = 1_000_000): Promise<T> {
  const raw = await req.text();
  if (raw.length > max) throw new HttpError(413, "Request too large.");
  let j: unknown;
  try { j = JSON.parse(raw || "{}"); } catch { throw new HttpError(400, "Invalid JSON."); }
  const r = schema.safeParse(j);
  if (!r.success) {
    const i = r.error.issues[0];
    throw new HttpError(400, `${i?.path.join(".") || "body"}: ${i?.message ?? "invalid"}`);
  }
  return r.data;
}

const clip = (max: number) => z.preprocess((v) => (v == null ? "" : String(v).trim().slice(0, max)), z.string());
const OpportunityZ = z.object({
  job_key: z.string().trim().min(1).max(300),
  source: clip(30).transform((v) => v.toLowerCase() || "other"),
  url: clip(1000).refine((u) => !u || /^https?:\/\//i.test(u), "url must be http(s)"),
  title: clip(300).transform((v) => v || "(untitled listing)"),
  company: clip(200), location: clip(200), remote: clip(20).transform((v) => v || "unknown"),
  employment_type: clip(30).transform((v) => v || "unknown"), budget: clip(150),
  skills: z.preprocess((v) => (Array.isArray(v) ? v.join(", ") : v), clip(1000)),
  experience_level: clip(80), summary: clip(2000),
  fit_score: z.coerce.number().catch(0).transform((n) => Math.max(0, Math.min(100, Math.round(n)))),
  practice: z.unknown().transform(normalisePractice),
  reasons: clip(1500), red_flags: clip(1000), action: clip(20).transform((v) => v || "review"),
  extraction_status: clip(200).transform((v) => v || "ok"),
  received_at: z.preprocess((v) => (v && !Number.isNaN(Date.parse(String(v))) ? new Date(String(v)) : new Date()), z.date()),
});
const N8N_FIELDS = ["source", "url", "title", "company", "location", "remote", "employment_type", "budget", "skills", "experience_level",
  "summary", "fit_score", "practice", "reasons", "red_flags", "action", "extraction_status"] as const;

export async function dispatchIngest(req: NextRequest, path: string) {
  const auth = await authIngest(req);
  const sql = db();

  if (req.method === "GET" && path === "/ping") return { ok: true, token: auth.tokenName, time: new Date().toISOString() };

  if (req.method === "POST" && path === "/opportunities") {
    const b = await body(req, z.object({ items: z.array(z.unknown()).max(200) }));
    let created = 0, updated = 0;
    const errors: { index: number; error: string }[] = [];
    for (let i = 0; i < b.items.length; i++) {
      const r = OpportunityZ.safeParse(b.items[i]);
      if (!r.success) { errors.push({ index: i, error: `${r.error.issues[0]?.path.join(".")}: ${r.error.issues[0]?.message}` }); continue; }
      const o = r.data;
      const [row] = await sql`
        insert into opportunities ${sql(o as never)}
        on conflict (job_key) do update set ${sql(Object.fromEntries(N8N_FIELDS.map((k) => [k, o[k]])) as never)}, updated_at = now()
        returning (xmax = 0) as inserted`;
      if (row.inserted) created++; else updated++;
    }
    return { ok: errors.length === 0, received: b.items.length, created, updated, errors };
  }

  if (req.method === "POST" && path === "/enquiries") {
    const b = await body(req, z.object({ items: z.array(z.unknown()).max(200) }));
    let created = 0, existing = 0;
    const errors: { index: number; error: string }[] = [];
    for (let i = 0; i < b.items.length; i++) {
      const r = IncomingEnquiryZ.safeParse(b.items[i]);
      if (!r.success || !r.data.submission_id) { errors.push({ index: i, error: r.success ? "submission_id is required" : r.error.issues[0]?.message ?? "invalid" }); continue; }
      const out = await storeEnquiry({ ...r.data, source: r.data.source === "website" ? "relay" : r.data.source }, null);
      if (out.created) created++; else existing++;
    }
    return { ok: errors.length === 0, received: b.items.length, created, existing, errors };
  }

  if (req.method === "POST" && path === "/enquiries/claim") {
    const b = await body(req, z.object({ limit: z.coerce.number().int().min(1).max(20).default(5) }));
    return { items: await claimForTriage(b.limit) };
  }

  const m = path.match(/^\/enquiries\/(\d{1,18})\/triage$/);
  if (req.method === "PATCH" && m) {
    const b = await body(req, z.object({ ok: z.boolean(), error: z.string().max(500).optional(), ai: EnquiryAIZ.optional() }));
    return saveTriage(m[1], b);
  }

  throw new HttpError(404, "Not found.");
}
