/**
 * Client portal (Phase 5). Clients sign in with a one-time emailed link (15 min, single use), then get a
 * cookie session (2 h idle, 12 h absolute). Access is recomputed on every request: the address must still be
 * the client's email or one of its contacts' emails, and the client must have the portal switched on.
 * Clients see sent quotes and issued invoices (never drafts or internal notes), can accept/decline quotes and
 * send proof of payment. Only token hashes are stored.
 */
import { z } from "zod";
import { db } from "./db";
import { randomToken, sha256 } from "./crypto";
import { audit, HttpError } from "./http";
import { sendMail } from "./mail";
import { storeAttachment } from "./attachments";
import type { Meta } from "./session";
import { formatDate, formatMoney, todayISO } from "@/crm/shared/calc";

export const PORTAL_COOKIE = process.env.NODE_ENV === "production" ? "__Host-auv_portal" : "auv_portal";
const LINK_TTL_MIN = 15;
const IDLE_MS = 2 * 3600e3;
const ABSOLUTE_MS = 12 * 3600e3;
const TOUCH_EVERY_MS = 5 * 60e3;

export type PortalClient = { id: string; name: string; currency: string };
export type PortalSession = { id: string; email: string; clients: PortalClient[] };

export const emailZ = z.string().trim().toLowerCase().max(254).pipe(z.email("Enter a valid email address."));

export async function clientsForEmail(email: string): Promise<PortalClient[]> {
  const rows = await db()`select c.id, c.name, c.currency from clients c
    where c.portal_enabled and not c.archived
      and (lower(c.email) = ${email} or exists (select 1 from contacts k where k.client_id = c.id and lower(k.email) = ${email}))
    order by c.name`;
  return rows.map((r) => ({ id: String(r.id), name: r.name as string, currency: r.currency as string }));
}

export function portalBase(req: Request) {
  const env = process.env.PORTAL_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL;
  return (env && !/localhost|127\.0\.0\.1/.test(env) ? env : new URL(req.url).origin).replace(/\/$/, "");
}

/** Always resolves the same way (no account enumeration); throws only on abuse limits. */
export async function requestLink(rawEmail: string, meta: Meta, base: string) {
  const email = emailZ.parse(rawEmail);
  const [lim] = await db()`select
      count(*) filter (where ip = ${meta.ip})::int as per_ip,
      count(*) filter (where lower(email) = ${email})::int as per_email
    from portal_tokens where created_at > now() - interval '15 minutes'`;
  if (lim.per_ip >= 10) throw new HttpError(429, "Too many requests. Please wait a few minutes and try again.");
  if (lim.per_email >= 3) return; // silently: the last links are still valid
  const clients = await clientsForEmail(email);
  if (!clients.length) {
    await db()`insert into portal_tokens (token_hash, email, ip, expires_at, used_at) values (${sha256(randomToken())}, ${email}, ${meta.ip}, now(), now())`; // counts toward the limits
    return;
  }
  const token = randomToken(32);
  await db()`insert into portal_tokens (token_hash, email, ip, expires_at) values (${sha256(token)}, ${email}, ${meta.ip}, now() + ${LINK_TTL_MIN} * interval '1 minute')`;
  const link = `${base}/portal/verify?t=${token}`;
  try {
    await sendMail({
      to: [email], cc: [], subject: "Your sign-in link for the Auvetric client portal",
      text: `Hello,\n\nUse this link to sign in to the Auvetric Data Solutions client portal:\n\n${link}\n\nThe link works once and expires in ${LINK_TTL_MIN} minutes. If you didn't ask for it, you can ignore this email.\n\nAuvetric Data Solutions`,
      attachments: [],
    }, { bcc: false });
  } catch (e) {
    console.error("[portal] sign-in email failed", e);
    await audit(null, "portal.mail_failed", meta, { email, error: (e as Error).message.slice(0, 200) });
  }
}

export async function verifyLink(token: string, meta: Meta) {
  if (!/^[\w-]{20,100}$/.test(token)) throw new HttpError(400, "This sign-in link is not valid. Request a new one.");
  const [t] = await db()`update portal_tokens set used_at = now() where token_hash = ${sha256(token)} and used_at is null and expires_at > now() returning email`;
  if (!t) throw new HttpError(410, "This sign-in link has expired or was already used. Request a new one.");
  const clients = await clientsForEmail(t.email);
  if (!clients.length) throw new HttpError(403, "Portal access for this address has been switched off. Please contact us.");
  const sess = randomToken();
  await db()`insert into portal_sessions (id, email, ip, user_agent, expires_at) values (${sha256(sess)}, ${t.email}, ${meta.ip}, ${meta.userAgent.slice(0, 300)}, now() + ${IDLE_MS / 1000} * interval '1 second')`;
  for (const c of clients) await event({ email: t.email, clientId: c.id, kind: "signin", ip: meta.ip });
  await db()`delete from portal_sessions where expires_at < now() - interval '1 day'`;
  await db()`delete from portal_tokens where created_at < now() - interval '30 days'`;
  return { token: sess, maxAge: ABSOLUTE_MS / 1000 };
}

export async function readPortalSession(token: string | undefined | null): Promise<PortalSession | null> {
  if (!token || token.length < 20 || token.length > 100) return null;
  const id = sha256(token);
  const [s] = await db()`select id, email, last_seen_at from portal_sessions where id = ${id} and expires_at > now() and created_at > now() - ${ABSOLUTE_MS / 1000} * interval '1 second'`;
  if (!s) return null;
  const clients = await clientsForEmail(s.email);
  if (!clients.length) return null;
  if (Date.now() - new Date(s.last_seen_at).getTime() > TOUCH_EVERY_MS) {
    await db()`update portal_sessions set last_seen_at = now(), expires_at = now() + ${IDLE_MS / 1000} * interval '1 second' where id = ${id}`;
  }
  return { id: s.id, email: s.email, clients };
}
export async function destroyPortalSession(id: string) { await db()`delete from portal_sessions where id = ${id}`; }
export function portalCookieOptions(maxAge: number) {
  return { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge };
}

export async function event(e: { email: string; clientId?: string | null; documentId?: string | null; kind: "invite" | "signin" | "view" | "accept" | "decline" | "proof"; ip?: string | null; detail?: Record<string, unknown> }) {
  await db()`insert into portal_events (email, client_id, document_id, kind, ip, detail)
    values (${e.email}, ${e.clientId ?? null}, ${e.documentId ?? null}, ${e.kind}, ${e.ip ?? null}, ${db().json((e.detail ?? {}) as never)})`;
}
async function activity(entity: "client" | "document", entityId: string | null, body: string) {
  if (entityId) await db()`insert into activities (entity, entity_id, kind, body, user_id) values (${entity}, ${entityId}, 'system', ${body}, null)`;
}

/** Visible to clients: sent/accepted/declined/invoiced quotes; sent/overdue/paid invoices. */
export async function portalDocuments(s: PortalSession) {
  const ids = s.clients.map((c) => c.id);
  return db()`select id, type, number, status, date, due_date, currency, total, amount_paid, client_id, data->>'remarks' as remarks
    from documents where client_id in ${db()(ids)}
      and ((type = 'quote' and status in ('sent','accepted','declined','invoiced')) or (type = 'invoice' and status in ('sent','overdue','paid')))
    order by date desc, id desc`;
}
export async function portalDocument(s: PortalSession, docId: string) {
  if (!/^\d{1,18}$/.test(docId)) throw new HttpError(404, "Document not found.");
  const [d] = await db()`select d.*, c.name as company_name, c.data as company_data from documents d join companies c on c.id = d.company_id
    where d.id = ${docId} and d.client_id in ${db()(s.clients.map((x) => x.id))}
      and ((d.type = 'quote' and d.status in ('sent','accepted','declined','invoiced')) or (d.type = 'invoice' and d.status in ('sent','overdue','paid')))`;
  if (!d) throw new HttpError(404, "Document not found.");
  return d;
}
export const assertClient = (s: PortalSession, clientId: string) => {
  if (!s.clients.some((c) => c.id === clientId)) throw new HttpError(404, "Not found.");
};

/** First view of a document by this address is put on the partners' timeline. */
export async function recordView(s: PortalSession, d: { id: unknown; client_id: unknown; type: string; number: string }, ip: string) {
  const [seen] = await db()`select 1 from portal_events where document_id = ${String(d.id)} and kind = 'view' and email = ${s.email} limit 1`;
  if (seen) return;
  await event({ email: s.email, clientId: String(d.client_id), documentId: String(d.id), kind: "view", ip });
  await activity("document", String(d.id), `Viewed in the client portal by ${s.email}`);
}

export async function notifyPartners(subject: string, text: string, meta: Meta) {
  const to = (await db()`select email from users where not disabled and role in ('admin','member')`).map((u) => u.email as string);
  if (!to.length) return;
  try { await sendMail({ to, cc: [], subject, text, attachments: [] }, { bcc: false }); }
  catch (e) { await audit(null, "portal.notify_failed", meta, { subject, error: (e as Error).message.slice(0, 200) }); }
}

export const AcceptBody = z.object({ name: z.string().trim().min(2, "Type your full name.").max(120), accept: z.literal(true, "Tick the box to accept.") });
export const DeclineBody = z.object({ reason: z.string().trim().max(2000).default("") });

export async function decideQuote(s: PortalSession, docId: string, decision: "accepted" | "declined", info: { name?: string; reason?: string }, meta: Meta, base: string) {
  const d = await portalDocument(s, docId);
  if (d.type !== "quote") throw new HttpError(404, "Document not found.");
  if (d.status !== "sent") throw new HttpError(409, d.status === "declined" ? "This quotation was declined." : "This quotation has already been accepted.");
  if (String(d.due_date) < todayISO()) throw new HttpError(409, `This quotation expired on ${formatDate(String(d.due_date))}. Please contact us for an updated quote.`);
  const record = decision === "accepted"
    ? { name: info.name, email: s.email, at: new Date().toISOString(), ip: meta.ip, user_agent: meta.userAgent.slice(0, 200), via: "portal" }
    : { reason: info.reason ?? "", email: s.email, at: new Date().toISOString(), ip: meta.ip, via: "portal" };
  const key = decision === "accepted" ? "acceptance" : "decline";
  const [u] = await db()`update documents set status = ${decision}, data = jsonb_set(data, ${`{${key}}`}::text[], ${db().json(record as never)}), updated_at = now()
    where id = ${d.id} and status = 'sent' returning id`;
  if (!u) throw new HttpError(409, "This quotation was just updated. Please reload the page.");
  await audit(null, `quote.status`, meta, { number: d.number, from: "sent", to: decision, by: s.email, via: "portal", ...(info.name ? { name: info.name } : {}) }, "document", String(d.id));
  await event({ email: s.email, clientId: String(d.client_id), documentId: String(d.id), kind: decision === "accepted" ? "accept" : "decline", ip: meta.ip, detail: record });
  const total = formatMoney(Number(d.total), d.currency);
  const who = decision === "accepted" ? `${info.name} (${s.email})` : s.email;
  const line = decision === "accepted" ? `Quote ${d.number} (${total}) accepted in the client portal by ${who}` : `Quote ${d.number} (${total}) declined in the client portal by ${who}${info.reason ? `: “${info.reason}”` : ""}`;
  await activity("document", String(d.id), line);
  await activity("client", String(d.client_id), line);
  const client = s.clients.find((c) => c.id === String(d.client_id))?.name ?? "";
  await notifyPartners(`${decision === "accepted" ? "Accepted" : "Declined"}: quote ${d.number} · ${client}`,
    `${line}.\n\nClient: ${client}\nTotal: ${total}\n${decision === "accepted" ? `Accepted at ${new Date().toLocaleString("en-NA", { timeZone: "Africa/Windhoek" })} from IP ${meta.ip}.` : ""}\n\nOpen it in the CRM: ${base}/crm/quotes/${d.id}`, meta);
  return { status: decision };
}

export const ProofFields = z.object({
  amount: z.coerce.number().positive("Enter the amount you paid.").max(1e10),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter the payment date."),
  reference: z.string().trim().max(200).default(""),
  note: z.string().trim().max(2000).default(""),
});

export async function paymentNotice(s: PortalSession, docId: string, fields: z.infer<typeof ProofFields>, file: File | null, meta: Meta, base: string) {
  const d = await portalDocument(s, docId);
  if (d.type !== "invoice" || d.status === "paid") throw new HttpError(409, "This invoice is already paid. Thank you!");
  if (fields.date > todayISO()) throw new HttpError(400, "The payment date can't be in the future.");
  const [{ n }] = await db()`select count(*)::int as n from payment_notices where document_id = ${d.id} and created_at > now() - interval '1 day'`;
  if (n >= 5) throw new HttpError(429, "We've received several notices for this invoice today. We'll be in touch.");
  let attachmentId: string | null = null;
  if (file && file.size > 0) {
    const renamed = new File([file], `Proof of payment - ${file.name}`.slice(0, 200), { type: file.type });
    const a = await storeAttachment("document", String(d.id), renamed, null as unknown as string);
    attachmentId = String(a.id);
  }
  const [row] = await db()`insert into payment_notices (document_id, client_id, email, amount, date, reference, note, attachment_id)
    values (${d.id}, ${d.client_id}, ${s.email}, ${fields.amount}, ${fields.date}, ${fields.reference}, ${fields.note}, ${attachmentId}) returning id`;
  const amount = formatMoney(fields.amount, d.currency);
  await event({ email: s.email, clientId: String(d.client_id), documentId: String(d.id), kind: "proof", ip: meta.ip, detail: { amount: fields.amount, date: fields.date, reference: fields.reference, notice_id: String(row.id) } });
  const line = `Payment of ${amount} on ${formatDate(fields.date)} reported in the client portal by ${s.email}${fields.reference ? ` (ref ${fields.reference})` : ""}${attachmentId ? ", proof attached" : ""}`;
  await activity("document", String(d.id), line);
  await activity("client", String(d.client_id), `Invoice ${d.number}: ${line}`);
  await audit(null, "portal.payment_notice", meta, { number: d.number, amount: fields.amount, by: s.email }, "document", String(d.id));
  const client = s.clients.find((c) => c.id === String(d.client_id))?.name ?? "";
  await notifyPartners(`Payment reported: invoice ${d.number} · ${client}`,
    `${line}.\n\nCheck the bank statement, then record the payment on the invoice (the notice is listed there):\n${base}/crm/invoices/${d.id}${fields.note ? `\n\nClient's note: ${fields.note}` : ""}`, meta);
  return { ok: true, id: String(row.id) };
}
