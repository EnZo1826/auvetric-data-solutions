/**
 * Enquiry storage shared by the public contact form (/api/contact, provider "crm") and the
 * n8n ingest API. Website submissions land here even when the PC running n8n is off; n8n
 * later claims them for AI triage (claimForTriage / saveTriage).
 */
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "./db";
import { HttpError } from "./http";
import { normalisePractice, type EnquiryAI } from "@/crm/shared/sales";

const s = (max: number) => z.string().trim().max(max).default("");
const clip = (max: number) => z.preprocess((v) => (v == null ? "" : String(v).trim().slice(0, max)), z.string());

export const EnquiryAIZ = z.object({
  category: clip(40),
  practice: clip(40),
  priority: z.enum(["high", "normal", "low"]).catch("normal"),
  spam_score: z.coerce.number().catch(0).transform((n) => Math.max(0, Math.min(100, Math.round(n)))),
  summary: clip(1500),
  key_requirements: clip(2000),
  questions_to_ask: clip(2000),
  suggested_reply: clip(4000),
}).partial();

export const IncomingEnquiryZ = z.object({
  submission_id: z.string().trim().min(1).max(200).optional(),
  source: z.enum(["website", "relay", "manual"]).default("website"),
  submitted_at: z.string().max(40).optional(),
  name: z.string().trim().min(1, "Name is required.").max(160),
  organisation: s(200), email: s(254), phone: s(60), intent: s(60), interest: s(120), budget: s(80), timeline: s(80),
  message: s(8000),
  ai: EnquiryAIZ.optional(),
});
export type IncomingEnquiry = z.input<typeof IncomingEnquiryZ>;

/** Inserts an enquiry once per submission_id. Returns the row and whether it was new. */
export async function storeEnquiry(input: IncomingEnquiry, ip: string | null) {
  const e = IncomingEnquiryZ.parse(input);
  const at = e.submitted_at && !Number.isNaN(Date.parse(e.submitted_at)) ? new Date(e.submitted_at) : new Date();
  const ai = e.ai && Object.keys(e.ai).length ? e.ai : null;
  const spam = ai ? (ai.spam_score ?? 0) >= 70 : false;
  const row = {
    submission_id: e.submission_id || randomUUID(), source: e.source, submitted_at: at,
    name: e.name, organisation: e.organisation, email: e.email, phone: e.phone, intent: e.intent, interest: e.interest,
    budget: e.budget, timeline: e.timeline, message: e.message, ip,
    status: spam ? "spam" : "new",
    triage_status: ai ? "done" : "pending", triaged_at: ai ? new Date() : null,
    ai: db().json((ai ?? {}) as never),
  };
  const [ins] = await db()`insert into enquiries ${db()(row as never)} on conflict (submission_id) do nothing returning *`;
  if (ins) return { enquiry: ins, created: true };
  const [existing] = await db()`select * from enquiries where submission_id = ${row.submission_id}`;
  return { enquiry: existing, created: false };
}

/**
 * Abuse guard for the public form (serverless instances share nothing, so count in the database):
 * at most 5 submissions per IP per 10 minutes and 100 in total per hour.
 */
export async function assertEnquiryRate(ip: string) {
  const [r] = await db()`select
      count(*) filter (where ip = ${ip} and created_at > now() - interval '10 minutes')::int as per_ip,
      count(*) filter (where created_at > now() - interval '1 hour')::int as total
    from enquiries where created_at > now() - interval '1 hour'`;
  if (r.per_ip >= 5 || r.total >= 100) throw new HttpError(429, "Too many submissions. Please try again in a few minutes.");
}

const CLAIM_TIMEOUT = "20 minutes"; // a claim older than this (n8n crashed mid-run) is released
const MAX_ATTEMPTS = 3;

/** Atomically hands up to `limit` untriaged enquiries to n8n. Safe under concurrent pollers. */
export async function claimForTriage(limit: number) {
  return db()`
    update enquiries set triage_status = 'claimed', triage_claimed_at = now(), triage_attempts = triage_attempts + 1, updated_at = now()
    where id in (
      select id from enquiries
      where status <> 'spam' and triage_attempts < ${MAX_ATTEMPTS}
        and (triage_status = 'pending' or (triage_status = 'claimed' and triage_claimed_at < now() - ${CLAIM_TIMEOUT}::interval))
      order by submitted_at limit ${limit} for update skip locked)
    returning id, submission_id, submitted_at, name, organisation, email, phone, intent, interest, budget, timeline, message, triage_attempts`;
}

/** Stores n8n's triage result. A failed attempt goes back to the queue until MAX_ATTEMPTS; `alert` tells n8n whether to email the partners. */
export async function saveTriage(enquiryId: string, body: { ok: boolean; error?: string; ai?: EnquiryAI }) {
  const [cur] = await db()`select id, status, triage_attempts, ai from enquiries where id = ${enquiryId}`;
  if (!cur) throw new HttpError(404, "Enquiry not found.");
  if (!body.ok) {
    const failed = cur.triage_attempts >= MAX_ATTEMPTS;
    const [row] = await db()`update enquiries set triage_status = ${failed ? "failed" : "pending"}, triage_claimed_at = null,
        ai = ai || ${db().json({ error: String(body.error ?? "triage failed").slice(0, 300) })}, updated_at = now()
      where id = ${enquiryId} returning id, triage_status`;
    // After the last attempt the partners are still emailed (with the raw message), so nothing waits unseen.
    return { ...row, alert: failed };
  }
  const ai = EnquiryAIZ.parse(body.ai ?? {});
  const practice = normalisePractice(ai.practice);
  const spam = (ai.spam_score ?? 0) >= 70;
  const [row] = await db()`update enquiries set triage_status = 'done', triaged_at = now(), triage_claimed_at = null,
      ai = ${db().json({ ...ai, practice: practice ?? ai.practice ?? "" } as never)},
      status = case when ${spam} and status = 'new' then 'spam' else status end, updated_at = now()
    where id = ${enquiryId} returning id, status, triage_status`;
  return { ...row, alert: !spam };
}
