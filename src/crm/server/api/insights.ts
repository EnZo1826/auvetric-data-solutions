/** Phase 4 API: attachments, email (SMTP), PDFs, backups, audit log, reports. Registered on import by the catch-all. */
import { z } from "zod";
import { db } from "../db";
import { audit, HttpError } from "../http";
import { id, route } from "../router";
import { logActivity, parse, loadDoc, setStatus } from "./routes";
import { assertEntity, ATTACH_ENTITIES, canInline, loadAttachment, MAX_UPLOAD, storeAttachment, type AttachEntity } from "../attachments";
import { fileResponse, fileStore, storageKind } from "../files";
import { emailList, fill, logEmail, mailSettingsView, MailSettingsBody, saveMailSettings, sendMail, template } from "../mail";
import { documentPdf, statementPdf } from "../pdf";
import { clientStatement } from "../finance";
import { runBackup } from "../backup";
import { buildReports } from "../reports";
import { formatDate, formatMoney, todayISO } from "@/crm/shared/calc";
import { PLACEHOLDER, type CompanyData, type Currency, type DocData } from "@/crm/shared/types";

const sql = () => db();
const isoQ = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const fileSafe = (s: string) => s.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);

// ───────────────────────── attachments ─────────────────────────
route("GET", "/attachments", async ({ query }) => {
  const entity = query.get("entity") ?? "";
  if (!(ATTACH_ENTITIES as readonly string[]).includes(entity)) throw new HttpError(400, "Unknown record type.");
  const eid = id(query.get("id"), "Record");
  return sql()`select a.id, a.name, a.content_type, a.size, a.created_at, u.name as uploaded_by_name
    from attachments a left join users u on u.id = a.uploaded_by where a.entity = ${entity} and a.entity_id = ${eid} order by a.created_at desc`;
});
route("POST", "/attachments", async ({ req, session, meta }) => {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > MAX_UPLOAD + 64 * 1024) throw new HttpError(413, "Files can be at most 4 MB.");
  let form: FormData;
  try { form = await req.formData(); } catch { throw new HttpError(400, "Send the file as a form upload."); }
  const entity = String(form.get("entity") ?? "");
  const eid = id(form.get("entity_id"), "Record");
  const file = form.get("file");
  if (!(file instanceof File)) throw new HttpError(400, "Choose a file to upload.");
  await assertEntity(entity, eid);
  const row = await storeAttachment(entity as AttachEntity, eid, file, session.user.id);
  await audit(session.user.id, "attachment.upload", meta, { name: row.name, size: row.size, entity, entity_id: eid }, "attachment", String(row.id));
  return row;
});
route("GET", "/attachments/:id/download", async ({ params, query }) => {
  const { meta, data } = await loadAttachment(id(params.id, "File"));
  return fileResponse(data, meta.name, meta.content_type, query.get("inline") === "1" && canInline(meta.name));
});
route("DELETE", "/attachments/:id", async ({ params, session, meta }) => {
  const aid = id(params.id, "File");
  const [a] = await sql()`delete from attachments where id = ${aid} returning name, blob_key, entity, entity_id`;
  if (!a) throw new HttpError(404, "File not found.");
  await fileStore("crm-files").del(a.blob_key).catch((e) => console.error("[crm] attachment delete", a.blob_key, e));
  await audit(session.user.id, "attachment.delete", meta, { name: a.name, entity: a.entity, entity_id: String(a.entity_id) }, "attachment", aid);
  return { ok: true };
});

// ───────────────────────── email settings ─────────────────────────
route("GET", "/settings/mail", async () => mailSettingsView(), { admin: true });
route("PUT", "/settings/mail", async ({ req, session, meta }) => {
  const b = await parse(req, MailSettingsBody);
  await saveMailSettings(b);
  await audit(session.user.id, "mail.settings", meta, { host: b.host, port: b.port, security: b.security, user: b.user, fromEmail: b.fromEmail, passwordChanged: !!b.password });
  return mailSettingsView();
}, { admin: true });
route("POST", "/settings/mail/test", async ({ req, session, meta }) => {
  const b = await parse(req, z.object({ to: z.string().trim().pipe(z.email("Enter a valid address.")).optional() }));
  const to = [b.to ?? session.user.email];
  const subject = "Auvetric CRM: test email";
  try {
    const r = await sendMail({ to, cc: [], subject, text: `This is a test from the Auvetric CRM, sent by ${session.user.name}.\n\nIf you can read this, outgoing email works.`, attachments: [] });
    await logEmail({ kind: "test", to, cc: [], subject, attachments: [], status: "sent", messageId: r.messageId, userId: session.user.id });
    await audit(session.user.id, "mail.test", meta, { to, ok: true });
    return { ok: true, to: to[0] };
  } catch (e) {
    await logEmail({ kind: "test", to, cc: [], subject, attachments: [], status: "failed", error: (e as Error).message, userId: session.user.id });
    await audit(session.user.id, "mail.test", meta, { to, ok: false });
    throw e;
  }
}, { admin: true });

// ───────────────────────── PDFs ─────────────────────────
async function companyFor(companyId: string) {
  const [c] = await sql()`select name, data from companies where id = ${companyId}`;
  return { name: c.name as string, data: c.data as CompanyData };
}
async function docPdf(d: Awaited<ReturnType<typeof loadDoc>>) {
  const bytes = await documentPdf({ type: d.type, number: d.number, date: String(d.date), due_date: String(d.due_date), currency: d.currency as Currency, data: d.data as DocData, status: d.status, amount_paid: Number(d.amount_paid ?? 0) }, await companyFor(String(d.company_id)));
  return { bytes, name: `${fileSafe(`${d.number} ${(d.data as DocData).client.name}`)}.pdf` };
}
route("GET", "/documents/:id/pdf", async ({ params, query }) => {
  const { bytes, name } = await docPdf(await loadDoc(params.id));
  return fileResponse(bytes, name, "application/pdf", query.get("inline") === "1");
});
async function statementFile(cid: string, from: string | null, to: string | null) {
  const st = await clientStatement(cid, from, to);
  const bytes = await statementPdf({ client: st.client as never, company: st.company as never, from: st.from, to: st.to, sections: st.sections });
  return { st, bytes, name: `${fileSafe(`Statement ${st.client.name} ${st.to}`)}.pdf` };
}
route("GET", "/clients/:id/statement/pdf", async ({ params, query }) => {
  const { bytes, name } = await statementFile(id(params.id, "Client"), isoQ(query.get("from")), isoQ(query.get("to")));
  return fileResponse(bytes, name, "application/pdf", query.get("inline") === "1");
});

// ───────────────────────── sending documents ─────────────────────────
async function recipients(clientId: string | null, primary: string) {
  const opts: { email: string; label: string }[] = [];
  const add = (email: string | null | undefined, label: string) => { const e = (email ?? "").trim(); if (e && !opts.some((o) => o.email.toLowerCase() === e.toLowerCase())) opts.push({ email: e, label }); };
  add(primary, "On the document");
  let contact = "";
  if (clientId) {
    const [c] = await sql()`select name, email from clients where id = ${clientId}`;
    add(c?.email, "Client");
    const contacts = await sql()`select name, email, role, is_primary from contacts where client_id = ${clientId} order by is_primary desc, name`;
    for (const k of contacts) add(k.email, `${k.name}${k.role ? `, ${k.role}` : ""}`);
    contact = contacts.find((k) => k.is_primary)?.name ?? contacts[0]?.name ?? "";
  }
  return { opts, contact };
}
async function history(where: { document_id?: string; client_id?: string; kind?: string }) {
  return where.document_id
    ? sql()`select e.id, e.kind, e.to_addrs, e.cc_addrs, e.subject, e.attachments, e.status, e.error, e.sent_at, u.name as sent_by_name from emails e left join users u on u.id = e.sent_by where e.document_id = ${where.document_id} order by e.sent_at desc limit 20`
    : sql()`select e.id, e.kind, e.to_addrs, e.cc_addrs, e.subject, e.attachments, e.status, e.error, e.sent_at, u.name as sent_by_name from emails e left join users u on u.id = e.sent_by where e.client_id = ${where.client_id!} and e.kind = ${where.kind!} order by e.sent_at desc limit 20`;
}
const placeholderWarning = (c: CompanyData, invoice: boolean) =>
  invoice && [c.bankName, c.bankAccount, c.bankAccountName].some((v) => (v ?? "").includes(PLACEHOLDER)) ? "The company banking details still say “[to be confirmed]”. Update the Company profile before sending invoices." : null;

route("GET", "/documents/:id/email", async ({ params, session }) => {
  const d = await loadDoc(params.id);
  const data = d.data as DocData;
  const company = await companyFor(String(d.company_id));
  const { opts, contact } = await recipients(d.client_id ? String(d.client_id) : null, data.client.email);
  const tpl = await template(d.type);
  const total = Number(d.total), paid = Number(d.amount_paid ?? 0);
  const vars = { number: d.number, client: data.client.name, contact: data.client.contact || contact || data.client.name, total: formatMoney(total, d.currency), balance: formatMoney(Math.max(0, total - paid), d.currency),
    due_date: formatDate(String(d.due_date)), company: company.data.tradingName || company.name, sender: session.user.name, period: "" };
  const attachments = await sql()`select id, name, size from attachments where entity = 'document' and entity_id = ${d.id} order by created_at`;
  const mail = await mailSettingsView();
  return { configured: mail.configured, from: mail.configured ? `${mail.fromName} <${mail.fromEmail}>` : null, to: opts[0]?.email ? [opts[0].email] : [], options: opts,
    subject: fill(tpl.subject, vars), body: fill(tpl.body, vars), pdf_name: `${fileSafe(`${d.number} ${data.client.name}`)}.pdf`, attachments, status: d.status,
    warning: placeholderWarning(company.data, d.type === "invoice"), history: await history({ document_id: String(d.id) }) };
});

const SendBody = z.object({
  to: emailList.min(1, "Add at least one recipient."), cc: emailList.default([]),
  subject: z.string().trim().min(1, "Enter a subject.").max(300), body: z.string().trim().min(1, "Enter a message.").max(20_000),
  attachment_ids: z.array(z.union([z.string(), z.number()]).transform(String)).max(10).default([]),
  mark_sent: z.boolean().default(true),
});
const MAX_MAIL_BYTES = 15 * 1024 * 1024;

route("POST", "/documents/:id/email", async ({ req, params, session, meta }) => {
  const b = await parse(req, SendBody);
  const d = await loadDoc(params.id);
  if (d.status === "cancelled") throw new HttpError(409, "Cancelled invoices can't be emailed.");
  const pdf = await docPdf(d);
  const files: { filename: string; content: Uint8Array; contentType: string }[] = [{ filename: pdf.name, content: pdf.bytes, contentType: "application/pdf" }];
  if (b.attachment_ids.length) {
    const ok = await sql()`select id from attachments where entity = 'document' and entity_id = ${d.id} and id in ${sql()(b.attachment_ids)}`;
    if (ok.length !== b.attachment_ids.length) throw new HttpError(400, "One of the selected files doesn't belong to this document.");
    for (const a of b.attachment_ids) { const f = await loadAttachment(a); files.push({ filename: f.meta.name, content: f.data, contentType: f.meta.content_type }); }
  }
  if (files.reduce((s, f) => s + f.content.byteLength, 0) > MAX_MAIL_BYTES) throw new HttpError(413, "The attachments add up to more than 15 MB. Leave some out.");
  const names = files.map((f) => f.filename);
  const base = { kind: d.type as "invoice" | "quote", documentId: String(d.id), clientId: d.client_id ? String(d.client_id) : null, to: b.to, cc: b.cc, subject: b.subject, attachments: names, userId: session.user.id };
  let r: { messageId: string };
  try {
    r = await sendMail({ to: b.to, cc: b.cc, subject: b.subject, text: b.body, attachments: files });
  } catch (e) {
    await logEmail({ ...base, status: "failed", error: (e as Error).message });
    await audit(session.user.id, "email.failed", meta, { to: b.to, number: d.number, error: (e as Error).message.slice(0, 200) }, "document", String(d.id));
    throw e;
  }
  await logEmail({ ...base, status: "sent", messageId: r.messageId });
  await audit(session.user.id, "email.sent", meta, { to: b.to, cc: b.cc, number: d.number, attachments: names }, "document", String(d.id));
  const who = b.to.join(", ");
  await logActivity("document", String(d.id), `Emailed to ${who}`, session.user.id);
  if (d.client_id) await logActivity("client", String(d.client_id), `${d.type === "invoice" ? "Invoice" : "Quote"} ${d.number} emailed to ${who}`, session.user.id);
  let status = d.status as string;
  if (b.mark_sent && d.status === "draft") status = String((await setStatus(String(d.id), "sent", session.user.id, meta))?.status ?? "sent");
  else if (d.status !== "draft") await sql()`update documents set sent_at = coalesce(sent_at, now()) where id = ${d.id}`;
  return { ok: true, status, to: b.to };
});

route("GET", "/clients/:id/statement/email", async ({ params, query, session }) => {
  const cid = id(params.id, "Client");
  const st = await clientStatement(cid, isoQ(query.get("from")), isoQ(query.get("to")));
  const { opts, contact } = await recipients(cid, "");
  const tpl = await template("statement");
  const company = st.company as unknown as { name: string; data: CompanyData };
  const balance = st.sections.filter((s) => s.closing > 0).map((s) => formatMoney(s.closing, s.currency)).join(" and ") || formatMoney(0, st.client.currency ?? "NAD");
  const vars = { client: st.client.name, contact: contact || st.client.name, balance, period: `${formatDate(st.from)} to ${formatDate(st.to)}`, company: company.data.tradingName || company.name,
    sender: session.user.name, number: "", total: balance, due_date: "" };
  const mail = await mailSettingsView();
  return { configured: mail.configured, from: mail.configured ? `${mail.fromName} <${mail.fromEmail}>` : null, to: opts[0]?.email ? [opts[0].email] : [], options: opts,
    subject: fill(tpl.subject, vars), body: fill(tpl.body, vars), pdf_name: `${fileSafe(`Statement ${st.client.name} ${st.to}`)}.pdf`, attachments: [], from_date: st.from, to_date: st.to,
    warning: placeholderWarning(company.data, true), history: await history({ client_id: cid, kind: "statement" }) };
});
route("POST", "/clients/:id/statement/email", async ({ req, params, session, meta }) => {
  const b = await parse(req, SendBody.extend({ from_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), to_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }));
  const cid = id(params.id, "Client");
  const { st, bytes, name } = await statementFile(cid, b.from_date ?? null, b.to_date ?? null);
  const base = { kind: "statement" as const, clientId: cid, to: b.to, cc: b.cc, subject: b.subject, attachments: [name], userId: session.user.id };
  try {
    const r = await sendMail({ to: b.to, cc: b.cc, subject: b.subject, text: b.body, attachments: [{ filename: name, content: bytes, contentType: "application/pdf" }] });
    await logEmail({ ...base, status: "sent", messageId: r.messageId });
  } catch (e) {
    await logEmail({ ...base, status: "failed", error: (e as Error).message });
    throw e;
  }
  await audit(session.user.id, "email.sent", meta, { to: b.to, statement: `${st.from}..${st.to}` }, "client", cid);
  await logActivity("client", cid, `Statement (${formatDate(st.from)} – ${formatDate(st.to)}) emailed to ${b.to.join(", ")}`, session.user.id);
  return { ok: true, to: b.to };
});

// ───────────────────────── backups ─────────────────────────
route("GET", "/backups", async () => ({
  storage: storageKind(),
  backups: await sql()`select b.id, b.kind, b.size, b.counts, b.created_at, u.name as created_by_name from backups b left join users u on u.id = b.created_by order by b.created_at desc limit 100`,
}), { admin: true });
route("POST", "/backups", async ({ session, meta }) => {
  const r = await runBackup("manual", session.user.id);
  await audit(session.user.id, "backup.manual", meta, { id: String(r.id), size: r.size, pruned: r.pruned });
  return r;
}, { admin: true });
route("GET", "/backups/:id/download", async ({ params, session, meta }) => {
  const [b] = await sql()`select * from backups where id = ${id(params.id, "Backup")}`;
  if (!b) throw new HttpError(404, "Backup not found.");
  const data = await fileStore("crm-backups").get(b.blob_key);
  if (!data) throw new HttpError(410, "The backup file is missing from storage.");
  await audit(session.user.id, "backup.download", meta, { id: String(b.id) });
  return fileResponse(data, b.blob_key.split("/").pop()!.replace(/^/, "auvetric-crm-"), "application/gzip");
}, { admin: true });

// ───────────────────────── audit log ─────────────────────────
route("GET", "/audit", async ({ query }) => {
  const s = sql();
  const before = query.get("before");
  const user = query.get("user");
  const action = (query.get("action") ?? "").trim();
  const entity = (query.get("entity") ?? "").trim();
  const entityId = query.get("entity_id");
  const from = isoQ(query.get("from")), to = isoQ(query.get("to"));
  const limit = Math.min(200, Math.max(1, Number(query.get("limit") ?? 100) || 100));
  const rows = await s`select a.id, a.at, a.user_id, u.name as user_name, a.action, a.entity, a.entity_id, a.ip, a.detail
    from audit_log a left join users u on u.id = a.user_id
    where true
      ${before ? s`and a.id < ${id(before)}` : s``}
      ${user === "system" ? s`and a.user_id is null` : user ? s`and a.user_id = ${id(user, "User")}` : s``}
      ${action ? s`and a.action like ${action.replace(/[%_\\]/g, "\\$&") + "%"}` : s``}
      ${entity ? s`and a.entity = ${entity}` : s``}
      ${entityId ? s`and a.entity_id = ${entityId}` : s``}
      ${from ? s`and a.at >= (${from}::date::timestamp at time zone 'Africa/Windhoek')` : s``}
      ${to ? s`and a.at < ((${to}::date + 1)::timestamp at time zone 'Africa/Windhoek')` : s``}
    order by a.id desc limit ${limit + 1}`;
  return { rows: rows.slice(0, limit), more: rows.length > limit };
}, { admin: true });
route("GET", "/audit/facets", async () => {
  const [actions, entities] = await Promise.all([
    sql()`select split_part(action, '.', 1) as prefix, count(*)::int as n from audit_log group by 1 order by 1`,
    sql()`select entity, count(*)::int as n from audit_log where entity is not null group by 1 order by 1`,
  ]);
  return { actions, entities };
}, { admin: true });

// ───────────────────────── reports ─────────────────────────
route("GET", "/reports", async ({ query }) => {
  const to = isoQ(query.get("to")) ?? todayISO();
  const from = isoQ(query.get("from")) ?? `${to.slice(0, 4)}-01-01`;
  return buildReports(from, to);
});
route("PATCH", "/users/:id/capacity", async ({ req, params, session, meta }) => {
  const b = await parse(req, z.object({ weekly_hours: z.coerce.number().min(0, "Between 0 and 80 hours.").max(80, "Between 0 and 80 hours.") }));
  const uid = id(params.id, "User");
  const [u] = await sql()`update users set weekly_hours = ${b.weekly_hours} where id = ${uid} returning id, weekly_hours`;
  if (!u) throw new HttpError(404, "User not found.");
  await audit(session.user.id, "user.capacity", meta, { weekly_hours: b.weekly_hours }, "user", uid);
  return u;
}, { admin: true });
