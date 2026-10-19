/** CRM-side API for the client portal (Phase 5): access per client, invitations, payment notices. */
import { z } from "zod";
import { db } from "../db";
import { audit, HttpError } from "../http";
import { id, route } from "../router";
import { logActivity, parse } from "./routes";
import { sendMail } from "../mail";
import { event, portalBase } from "../portal";

const sql = () => db();

async function people(cid: string) {
  const [c] = await sql()`select id, name, email, portal_enabled from clients where id = ${cid}`;
  if (!c) throw new HttpError(404, "Client not found.");
  const out: { email: string; label: string }[] = [];
  const add = (e: string | null, label: string) => { const v = (e ?? "").trim().toLowerCase(); if (v && !out.some((o) => o.email === v)) out.push({ email: v, label }); };
  add(c.email, "Client email");
  for (const k of await sql()`select name, email, role from contacts where client_id = ${cid} order by is_primary desc, name`) add(k.email, `${k.name}${k.role ? `, ${k.role}` : ""}`);
  return { client: c, people: out };
}

route("GET", "/clients/:id/portal", async ({ params }) => {
  const cid = id(params.id, "Client");
  const { client, people: ppl } = await people(cid);
  const events = await sql()`select e.id, e.at, e.email, e.kind, e.detail, d.number, d.type, e.document_id
    from portal_events e left join documents d on d.id = e.document_id where e.client_id = ${cid} order by e.at desc limit 30`;
  const [{ sessions }] = await sql()`select count(*)::int as sessions from portal_sessions where expires_at > now() and lower(email) in ${sql()(ppl.length ? ppl.map((p) => p.email) : [""])}`;
  return { enabled: client.portal_enabled, people: ppl, events, active_sessions: sessions };
});

route("PATCH", "/clients/:id/portal", async ({ req, params, session, meta }) => {
  const cid = id(params.id, "Client");
  const b = await parse(req, z.object({ enabled: z.boolean() }));
  const [c] = await sql()`update clients set portal_enabled = ${b.enabled}, updated_at = now() where id = ${cid} returning id`;
  if (!c) throw new HttpError(404, "Client not found.");
  await audit(session.user.id, b.enabled ? "portal.enabled" : "portal.disabled", meta, {}, "client", cid);
  await logActivity("client", cid, b.enabled ? "Client portal switched on" : "Client portal switched off", session.user.id);
  return { enabled: b.enabled };
});

route("POST", "/clients/:id/portal/invite", async ({ req, params, session, meta }) => {
  const cid = id(params.id, "Client");
  const b = await parse(req, z.object({ email: z.string().trim().toLowerCase().pipe(z.email("Choose an address.")) }));
  const { client, people: ppl } = await people(cid);
  if (!client.portal_enabled) throw new HttpError(409, "Switch the portal on for this client first.");
  if (!ppl.some((p) => p.email === b.email)) throw new HttpError(400, "Only the client's email or one of its contacts can be invited.");
  const link = `${portalBase(req)}/portal/login?email=${encodeURIComponent(b.email)}`;
  await sendMail({
    to: [b.email], cc: [], subject: "Your Auvetric client portal",
    text: `Hello,\n\n${session.user.name} has given you access to the Auvetric Data Solutions client portal for ${client.name}.\n\nThere you can view and download your quotations, invoices and statement, accept quotations online and let us know when you've paid.\n\nSign in here with this email address (no password; we email you a one-time link each time):\n${link}\n\nKind regards,\n${session.user.name}\nAuvetric Data Solutions`,
    attachments: [],
  });
  await event({ email: b.email, clientId: cid, kind: "invite", ip: meta.ip, detail: { by: session.user.name } });
  await audit(session.user.id, "portal.invite", meta, { email: b.email }, "client", cid);
  await logActivity("client", cid, `Portal invitation sent to ${b.email}`, session.user.id);
  return { ok: true };
});

const NOTICE_SELECT = (s: ReturnType<typeof db>) => s`select n.*, d.number, d.currency, d.total, d.amount_paid, d.status as doc_status, c.name as client_name, a.name as file_name, u.name as handled_by_name
  from payment_notices n join documents d on d.id = n.document_id left join clients c on c.id = n.client_id
  left join attachments a on a.id = n.attachment_id left join users u on u.id = n.handled_by`;
route("GET", "/payment-notices", async ({ query }) => {
  const s = sql();
  const status = query.get("status") ?? "new";
  if (!["new", "recorded", "dismissed", "all"].includes(status)) throw new HttpError(400, "Unknown status.");
  return s`${NOTICE_SELECT(s)} ${status === "all" ? s`` : s`where n.status = ${status}`} order by n.created_at desc limit 200`;
});
route("GET", "/documents/:id/notices", async ({ params }) => {
  const s = sql();
  return s`${NOTICE_SELECT(s)} where n.document_id = ${id(params.id, "Document")} order by n.created_at desc`;
});
route("PATCH", "/payment-notices/:id", async ({ req, params, session, meta }) => {
  const nid = id(params.id, "Notice");
  const b = await parse(req, z.object({ status: z.enum(["recorded", "dismissed", "new"]) }));
  const [n] = await sql()`update payment_notices set status = ${b.status}, handled_by = ${b.status === "new" ? null : session.user.id}, handled_at = ${b.status === "new" ? null : new Date()}
    where id = ${nid} returning id, document_id, amount, status`;
  if (!n) throw new HttpError(404, "Notice not found.");
  await audit(session.user.id, `payment_notice.${b.status}`, meta, { amount: Number(n.amount) }, "document", String(n.document_id));
  return n;
});
