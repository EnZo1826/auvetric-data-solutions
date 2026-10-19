/** CRM JSON API routes (Phase 1; Phase 2 sales routes live in ./sales.ts). Registered on import; dispatched by app/api/crm/[...path]/route.ts. */
import { z } from "zod";
import { db } from "../db";
import { audit, HttpError } from "../http";
import { id, route } from "../router";
import { email, idRef, LinesZ, money, name, optDate, practice, currency, text } from "../validate";
import { DocBody, dailyRun, generateRetainers, saveDocument, type DocInput } from "../documents";
import { hashPassword } from "../password";
import { destroyOtherSessions } from "../session";
import { todayISO, uid } from "@/crm/shared/calc";
import { DEFAULT_PROJECT_COLUMNS, INVOICE_STATUSES, QUOTE_STATUSES, type BoardColumn } from "@/crm/shared/types";
import { randomInt } from "node:crypto";

const sql = () => db();

export async function logActivity(entity: "client" | "project" | "document" | "lead" | "enquiry" | "opportunity", entityId: string | null, body: string, userId: string | null, kind = "system") {
  if (!entityId) return;
  await sql()`insert into activities (entity, entity_id, kind, body, user_id) values (${entity}, ${entityId}, ${kind}, ${body}, ${userId})`;
}

export async function parse<T>(req: Request, schema: z.ZodType<T>): Promise<T> {
  const raw = await req.text();
  if (raw.length > 512_000) throw new HttpError(413, "Request too large.");
  let body: unknown;
  try { body = JSON.parse(raw || "{}"); } catch { throw new HttpError(400, "Invalid JSON."); }
  const r = schema.safeParse(body);
  if (!r.success) {
    const i = r.error.issues[0];
    throw new HttpError(400, i?.message && !/^Invalid input/.test(i.message) ? i.message : `Check the ${i?.path.join(".") || "form"} field.`);
  }
  return r.data;
}

// ───────────────────────── company profile ─────────────────────────
const CompanyBody = z.object({
  name: name("Company name", 200),
  data: z.object({
    legalName: text(200), tradingName: text(200), regNo: text(100), vatRegistered: z.boolean().default(false), vatNo: text(100),
    vatRate: money.default(15), address: text(1000), email: text(254), phone: text(100), website: text(200),
    bankName: text(200), bankAccountName: text(200), bankBranch: text(200), bankBranchCode: text(50), bankAccount: text(100),
    bankSwift: text(50), bankExtra: text(1000), paymentTermsDays: z.coerce.number().int().min(0).max(365).default(14),
    quoteValidDays: z.coerce.number().int().min(1).max(365).default(30), terms: text(5000),
    invoicePrefix: text(40), quotePrefix: text(40), numberPad: z.coerce.number().int().min(1).max(8).default(4),
    nextInvoice: z.coerce.number().int().min(1).max(1e9), nextQuote: z.coerce.number().int().min(1).max(1e9),
    defaultCurrency: currency.default("NAD"), usdToNad: money.refine((n) => n > 0, "Exchange rate must be above zero."), footerText: text(500),
  }),
});
route("GET", "/company", async () => (await sql()`select id, name, data, updated_at from companies where is_default`)[0]);
route("PUT", "/company", async ({ req, session, meta }) => {
  const b = await parse(req, CompanyBody);
  if (b.data.vatRegistered && !b.data.vatNo.trim()) throw new HttpError(400, "Enter the VAT number before switching VAT on.");
  const [cur] = await sql()`select id, name, data from companies where is_default`;
  const [row] = await sql()`update companies set name = ${b.name}, data = ${sql().json(b.data as never)}, updated_at = now() where id = ${cur.id} returning id, name, data, updated_at`;
  const changed = Object.keys(b.data).filter((k) => JSON.stringify((cur.data as Record<string, unknown>)[k]) !== JSON.stringify((b.data as Record<string, unknown>)[k]));
  await audit(session.user.id, "company.update", meta, { changed }, "company", cur.id);
  return row;
}, { admin: true });

// ───────────────────────── clients & contacts ─────────────────────────
const ClientBody = z.object({
  name: name("Client name"), trading_name: text(300), industry: text(120), address: text(1000), email, phone: text(100),
  website: text(300), vat_no: text(100), reg_no: text(100), currency: currency.default("NAD"),
  payment_terms_days: z.union([z.coerce.number().int().min(0).max(365), z.literal(""), z.null()]).optional().transform((v) => (v === "" || v == null ? null : v)),
  notes: text(10000), tags: z.array(z.string().trim().max(40)).max(20).default([]), archived: z.boolean().default(false),
});
route("GET", "/clients", async () => sql()`
  select c.*, (select count(*)::int from documents d where d.client_id = c.id) as doc_count,
    (select coalesce(sum(case when d.currency = 'NAD' then d.total else d.total * d.fx_rate end), 0) from documents d
       where d.client_id = c.id and d.type = 'invoice' and d.status in ('sent','overdue')) as outstanding_nad,
    (select count(*)::int from projects p where p.client_id = c.id and p.status <> 'done') as open_projects,
    (select json_build_object('name', k.name, 'email', k.email) from contacts k where k.client_id = c.id order by k.is_primary desc, k.id limit 1) as primary_contact
  from clients c order by c.archived, lower(c.name)`);
route("GET", "/clients/:id", async ({ params }) => {
  const cid = id(params.id, "Client");
  const [client] = await sql()`select * from clients where id = ${cid}`;
  if (!client) throw new HttpError(404, "Client not found.");
  const [contacts, documents, projects, retainers, activities] = await Promise.all([
    sql()`select * from contacts where client_id = ${cid} order by is_primary desc, name`,
    sql()`select id, type, number, status, date, due_date, currency, fx_rate, total from documents where client_id = ${cid} order by date desc, id desc limit 200`,
    sql()`select id, title, status, priority, due_date from projects where client_id = ${cid} order by updated_at desc`,
    sql()`select id, name, kind, currency, active, auto from retainers where client_id = ${cid} order by name`,
    sql()`select a.*, u.name as user_name from activities a left join users u on u.id = a.user_id
          where a.entity = 'client' and a.entity_id = ${cid} order by a.at desc limit 200`,
  ]);
  return { client, contacts, documents, projects, retainers, activities };
});
route("POST", "/clients", async ({ req, session }) => {
  const b = await parse(req, ClientBody);
  const [c] = await sql()`insert into clients ${sql()(b as never)} returning *`;
  await logActivity("client", c.id, "Client created", session.user.id);
  return c;
});
route("PUT", "/clients/:id", async ({ req, params }) => {
  const b = await parse(req, ClientBody);
  const [c] = await sql()`update clients set ${sql()(b as never)}, updated_at = now() where id = ${id(params.id, "Client")} returning *`;
  if (!c) throw new HttpError(404, "Client not found.");
  return c;
});
route("DELETE", "/clients/:id", async ({ params, session, meta }) => {
  const cid = id(params.id, "Client");
  const [{ n }] = await sql()`select (select count(*) from documents where client_id = ${cid}) + (select count(*) from retainers where client_id = ${cid})
                                    + (select count(*) from projects where client_id = ${cid}) as n`;
  if (Number(n) > 0) {
    await sql()`update clients set archived = true, updated_at = now() where id = ${cid}`;
    return { ok: true, archived: true };
  }
  await sql()`delete from activities where entity = 'client' and entity_id = ${cid}`;
  await sql()`delete from clients where id = ${cid}`;
  await audit(session.user.id, "client.delete", meta, {}, "client", cid);
  return { ok: true, archived: false };
});

const ContactBody = z.object({ name: name("Contact name", 200), role: text(120), email, phone: text(100), is_primary: z.boolean().default(false), notes: text(2000) });
async function savePrimary(clientId: string, contactId: string, isPrimary: boolean) {
  if (isPrimary) await sql()`update contacts set is_primary = (id = ${contactId}) where client_id = ${clientId}`;
}
route("POST", "/clients/:id/contacts", async ({ req, params }) => {
  const cid = id(params.id, "Client");
  const b = await parse(req, ContactBody);
  const [{ n }] = await sql()`select count(*)::int as n from contacts where client_id = ${cid}`;
  const [k] = await sql()`insert into contacts ${sql()({ ...b, is_primary: b.is_primary || n === 0, client_id: cid } as never)} returning *`;
  await savePrimary(cid, k.id, k.is_primary);
  return k;
});
route("PUT", "/contacts/:id", async ({ req, params }) => {
  const b = await parse(req, ContactBody);
  const [k] = await sql()`update contacts set ${sql()(b as never)} where id = ${id(params.id, "Contact")} returning *`;
  if (!k) throw new HttpError(404, "Contact not found.");
  await savePrimary(k.client_id, k.id, k.is_primary);
  return k;
});
route("DELETE", "/contacts/:id", async ({ params }) => {
  await sql()`delete from contacts where id = ${id(params.id, "Contact")}`;
  return { ok: true };
});

// ───────────────────────── activity timeline ─────────────────────────
const ACTIVITY_TABLES = { client: "clients", project: "projects", lead: "leads", enquiry: "enquiries", opportunity: "opportunities" } as const;
const ActivityBody = z.object({ entity: z.enum(["client", "project", "lead", "enquiry", "opportunity"]), entity_id: z.union([z.string(), z.number()]), kind: z.enum(["note", "call", "email", "meeting"]), body: name("Note", 10000) });
route("POST", "/activities", async ({ req, session }) => {
  const b = await parse(req, ActivityBody);
  const eid = id(b.entity_id);
  const exists = await sql()`select 1 from ${sql()(ACTIVITY_TABLES[b.entity])} where id = ${eid}`;
  if (!exists.length) throw new HttpError(404, "Record not found.");
  const [a] = await sql()`insert into activities (entity, entity_id, kind, body, user_id) values (${b.entity}, ${eid}, ${b.kind}, ${b.body}, ${session.user.id}) returning *`;
  return { ...a, user_name: session.user.name };
});
route("DELETE", "/activities/:id", async ({ params, session }) => {
  const [a] = await sql()`delete from activities where id = ${id(params.id)} and kind <> 'system' and (user_id = ${session.user.id} or ${session.user.role === "admin"}) returning id`;
  if (!a) throw new HttpError(403, "You can only delete your own notes.");
  return { ok: true };
});

// ───────────────────────── services catalogue ─────────────────────────
const ServiceBody = z.object({ practice, code: text(40), name: name("Service name"), description: text(4000), unit: text(30).transform((u) => u || "Hour"), rate: money.default(0), currency: currency.default("NAD"), active: z.boolean().default(true) });
route("GET", "/services", async () => sql()`select * from services order by practice, lower(name)`);
route("POST", "/services", async ({ req }) => (await sql()`insert into services ${sql()((await parse(req, ServiceBody)) as never)} returning *`)[0]);
route("PUT", "/services/:id", async ({ req, params }) => {
  const [s] = await sql()`update services set ${sql()((await parse(req, ServiceBody)) as never)} where id = ${id(params.id, "Service")} returning *`;
  if (!s) throw new HttpError(404, "Service not found.");
  return s;
});
route("DELETE", "/services/:id", async ({ params }) => {
  await sql()`delete from services where id = ${id(params.id, "Service")}`;
  return { ok: true };
});

// ───────────────────────── quotes & invoices ─────────────────────────
route("GET", "/documents", async ({ query }) => {
  const s = sql();
  const type = query.get("type");
  const q = query.get("q")?.trim();
  const like = q ? `%${q.replace(/[%_\\]/g, (m) => "\\" + m)}%` : null;
  const status = query.get("status");
  const clientId = query.get("client_id");
  const projectId = query.get("project_id");
  const period = query.get("period");
  return s`
    select id, type, number, status, date, due_date, currency, fx_rate, total, client_id, project_id, retainer_id, source_id,
           data->'client'->>'name' as client_name, coalesce(data->>'remarks', '') as remarks
    from documents where true
      ${type === "invoice" || type === "quote" ? s`and type = ${type}` : s``}
      ${status ? s`and status = ${status}` : s``}
      ${clientId && /^\d+$/.test(clientId) ? s`and client_id = ${clientId}` : s``}
      ${projectId && /^\d+$/.test(projectId) ? s`and project_id = ${projectId}` : s``}
      ${period && /^\d{4}-\d{2}$/.test(period) ? s`and to_char(date, 'YYYY-MM') = ${period}` : s``}
      ${like ? s`and (number ilike ${like} or data->'client'->>'name' ilike ${like} or data->>'remarks' ilike ${like})` : s``}
    order by date desc, id desc limit ${Math.min(Number(query.get("limit")) || 1000, 5000)}`;
});
async function loadDoc(docId: string) {
  const [d] = await sql()`select * from documents where id = ${id(docId, "Document")}`;
  if (!d) throw new HttpError(404, "Document not found.");
  return d;
}
route("GET", "/documents/:id", async ({ params }) => {
  const d = await loadDoc(params.id);
  const [company] = await sql()`select id, name, data from companies where id = ${d.company_id}`;
  const [source] = d.source_id ? await sql()`select id, type, number from documents where id = ${d.source_id}` : [null];
  const derived = await sql()`select id, type, number, status from documents where source_id = ${d.id} order by id`;
  return { ...d, company, source, derived };
});
route("POST", "/documents", async ({ req, session, meta }) => {
  const b = await parse(req, DocBody);
  const d = await saveDocument(b as DocInput, session.user.id);
  await audit(session.user.id, `${d.type}.create`, meta, { number: d.number, total: d.total, currency: d.currency }, "document", d.id);
  await logActivity("client", d.client_id, `${d.type === "invoice" ? "Invoice" : "Quote"} ${d.number} created`, session.user.id);
  return d;
});
route("PUT", "/documents/:id", async ({ req, params, session, meta }) => {
  const existing = await loadDoc(params.id);
  const b = await parse(req, DocBody);
  const d = await saveDocument(b as DocInput, session.user.id, existing as never);
  await audit(session.user.id, `${d.type}.update`, meta, { number: d.number, before: { total: existing.total, status: existing.status }, after: { total: d.total, status: d.status } }, "document", d.id);
  return d;
});
const StatusBody = z.object({ status: z.string().max(20) });
async function setStatus(docId: string, status: string, userId: string, meta: Parameters<typeof audit>[2]) {
  const d = await loadDoc(docId);
  const allowed: readonly string[] = d.type === "invoice" ? INVOICE_STATUSES : QUOTE_STATUSES;
  if (!allowed.includes(status)) throw new HttpError(400, "Invalid status.");
  if (d.status === status) return d;
  if (d.type === "quote" && status === "invoiced") throw new HttpError(400, "Use “Convert to invoice” to invoice a quote.");
  if (d.status === "cancelled") throw new HttpError(409, "Cancelled invoices can't be reopened. Duplicate it instead.");
  const [row] = await sql()`update documents set status = ${status},
      sent_at = case when ${status} in ('sent','paid','overdue','accepted','declined') then coalesce(sent_at, now()) else sent_at end,
      paid_at = case when ${status} = 'paid' then now() else null end, updated_at = now()
    where id = ${d.id} returning *`;
  await audit(userId, `${d.type}.status`, meta, { number: d.number, from: d.status, to: status }, "document", d.id);
  await logActivity("client", d.client_id, `${d.type === "invoice" ? "Invoice" : "Quote"} ${d.number} marked ${status}`, userId);
  return row;
}
route("PATCH", "/documents/:id/status", async ({ req, params, session, meta }) => setStatus(params.id, (await parse(req, StatusBody)).status, session.user.id, meta));
route("POST", "/documents/bulk-status", async ({ req, session, meta }) => {
  const b = await parse(req, z.object({ ids: z.array(z.union([z.string(), z.number()])).min(1).max(200), status: z.string().max(20) }));
  const results = [];
  for (const x of b.ids) {
    try { await setStatus(String(x), b.status, session.user.id, meta); results.push({ id: String(x), ok: true }); }
    catch (e) { results.push({ id: String(x), ok: false, error: (e as Error).message }); }
  }
  return { results };
});
route("DELETE", "/documents/:id", async ({ params, session, meta }) => {
  const d = await loadDoc(params.id);
  if (d.status !== "draft") throw new HttpError(409, d.type === "invoice" ? "Only drafts can be deleted. Cancel the invoice instead so the number stays accounted for." : "Only draft quotes can be deleted.");
  await sql()`delete from documents where id = ${d.id}`;
  await audit(session.user.id, `${d.type}.delete`, meta, { number: d.number, total: d.total }, "document", d.id);
  return { ok: true };
});
function copyBody(src: Record<string, unknown> & { data: Record<string, unknown> }, type: "invoice" | "quote", extra: Partial<DocInput> = {}): DocInput {
  const data = src.data as { client: Record<string, string>; remarks: string; lines: { id: string }[]; discount: number; vatRate: number; notes: string; proposal?: Record<string, string> };
  return {
    type, client_id: src.client_id as string | null, contact_id: src.contact_id as string | null, project_id: src.project_id as string | null,
    currency: src.currency as "NAD" | "USD", fx_rate: src.fx_rate as number | null, status: "draft", date: todayISO(),
    data: { client: data.client, remarks: data.remarks, lines: data.lines.map((l) => ({ ...l, id: uid() })) as never, discount: data.discount, vatRate: data.vatRate, notes: "", proposal: data.proposal },
    ...extra,
  } as DocInput;
}
route("POST", "/documents/:id/duplicate", async ({ req, params, session, meta }) => {
  const src = await loadDoc(params.id);
  const b = await parse(req, z.object({ type: z.enum(["invoice", "quote"]).optional() }));
  const type = b.type ?? src.type;
  const d = await saveDocument(copyBody(src as never, type, { source_id: type !== src.type ? src.id : null }), session.user.id);
  await audit(session.user.id, `${d.type}.create`, meta, { number: d.number, from: src.number }, "document", d.id);
  return d;
});
route("POST", "/documents/:id/convert", async ({ params, session, meta }) => {
  const src = await loadDoc(params.id);
  if (src.type !== "quote") throw new HttpError(400, "Only quotes can be converted.");
  if (src.status === "invoiced") throw new HttpError(409, "This quote has already been invoiced.");
  if (src.status === "declined") throw new HttpError(409, "This quote was declined. Reopen it first.");
  const inv = await saveDocument(copyBody(src as never, "invoice", { source_id: src.id }), session.user.id);
  await sql()`update documents set status = 'invoiced', updated_at = now() where id = ${src.id}`;
  await audit(session.user.id, "quote.converted", meta, { quote: src.number, invoice: inv.number, total: inv.total }, "document", src.id);
  await logActivity("client", src.client_id, `Quote ${src.number} converted to invoice ${inv.number}`, session.user.id);
  return inv;
});
route("POST", "/documents/:id/project", async ({ params, session }) => {
  const q = await loadDoc(params.id);
  if (q.type !== "quote") throw new HttpError(400, "Projects are created from quotes.");
  if (q.project_id) return (await sql()`select * from projects where id = ${q.project_id}`)[0];
  const cols = await projectColumns();
  const [{ p }] = await sql()`select coalesce(max(position), 0) + 1000 as p from projects where status = ${cols[0].key}`;
  const lines = (q.data.lines ?? []) as { item: string; description: string; unit: string; qty: number }[];
  const hours = lines.filter((l) => /hour|hr/i.test(l.unit)).reduce((s, l) => s + Number(l.qty || 0), 0) + lines.filter((l) => /day/i.test(l.unit)).reduce((s, l) => s + Number(l.qty || 0) * 8, 0);
  const [proj] = await sql()`insert into projects ${sql()({
    title: (q.data.remarks && q.data.remarks !== "No Remarks" ? q.data.remarks : `${q.data.client.name} — ${q.number}`).slice(0, 300),
    client_id: q.client_id, status: cols[0].key, position: p, lead_user_id: session.user.id, quote_id: q.id,
    budget_amount: q.total, budget_currency: q.currency, budget_hours: hours || null,
    data: sql().json({ description: q.data.proposal?.scope || "", checklist: lines.map((l) => ({ id: uid(), text: l.item || l.description.split("\n")[0], done: false })).slice(0, 50), milestones: [], tags: [], hours: 0 }),
  } as never)} returning *`;
  await sql()`update documents set project_id = ${proj.id}, updated_at = now() where id = ${q.id}`;
  await logActivity("project", proj.id, `Project created from quote ${q.number}`, session.user.id);
  return proj;
});

// ───────────────────────── retainers ─────────────────────────
const RetainerBody = z.object({
  client_id: z.union([z.string().regex(/^\d+$/), z.number()]).transform(String), name: text(200), kind: z.enum(["support", "hosting", "sla", "bi", "other"]),
  currency: currency.default("NAD"), active: z.boolean().default(true), auto: z.boolean().default(false),
  day_of_month: z.coerce.number().int().min(1).max(28).default(1),
  data: z.object({ lines: LinesZ, remarks: text(2000), discount: money.default(0) }),
});
route("GET", "/retainers", async () => sql()`select r.*, c.name as client_name from retainers r join clients c on c.id = r.client_id order by r.active desc, lower(c.name)`);
route("GET", "/retainers/status", async ({ query }) => {
  const period = /^\d{4}-\d{2}$/.test(query.get("period") ?? "") ? query.get("period")! : todayISO().slice(0, 7);
  return sql()`select r.id, d.id as document_id, d.number, d.status, d.total, d.currency from retainers r
               left join documents d on d.retainer_id = r.id and d.period = ${period}`;
});
async function retainerFields(req: Request) {
  const b = await parse(req, RetainerBody);
  const [c] = await sql()`select name from clients where id = ${b.client_id}`;
  if (!c) throw new HttpError(400, "Client not found.");
  return { ...b, name: b.name || `${c.name} retainer`, data: sql().json(b.data as never) };
}
route("POST", "/retainers", async ({ req, session, meta }) => {
  const company = (await sql()`select id from companies where is_default`)[0];
  const [r] = await sql()`insert into retainers ${sql()({ ...(await retainerFields(req)), company_id: company.id } as never)} returning *`;
  await audit(session.user.id, "retainer.create", meta, { name: r.name }, "retainer", r.id);
  return r;
});
route("PUT", "/retainers/:id", async ({ req, params, session, meta }) => {
  const [r] = await sql()`update retainers set ${sql()((await retainerFields(req)) as never)}, updated_at = now() where id = ${id(params.id, "Retainer")} returning *`;
  if (!r) throw new HttpError(404, "Retainer not found.");
  await audit(session.user.id, "retainer.update", meta, { name: r.name, active: r.active, auto: r.auto }, "retainer", r.id);
  return r;
});
route("DELETE", "/retainers/:id", async ({ params, session, meta }) => {
  const rid = id(params.id, "Retainer");
  const [{ n }] = await sql()`select count(*)::int as n from documents where retainer_id = ${rid}`;
  if (n > 0) {
    await sql()`update retainers set active = false, auto = false, updated_at = now() where id = ${rid}`;
    return { ok: true, deactivated: true };
  }
  await sql()`delete from retainers where id = ${rid}`;
  await audit(session.user.id, "retainer.delete", meta, {}, "retainer", rid);
  return { ok: true, deactivated: false };
});
route("POST", "/retainers/generate", async ({ req, session, meta }) => {
  const b = await parse(req, z.object({ period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Period must be YYYY-MM."), ids: z.array(z.union([z.string(), z.number()]).transform(String)).max(500).optional() }));
  const r = await generateRetainers(b.period, { ids: b.ids, userId: session.user.id });
  if (r.created.length) await audit(session.user.id, "retainer.generate", meta, { period: b.period, created: r.created.map((x) => x.number) });
  return r;
});
route("POST", "/retainers/from-document/:id", async ({ params, session, meta }) => {
  const d = await loadDoc(params.id);
  if (!d.client_id) throw new HttpError(400, "Link the document to a client first.");
  const company = (await sql()`select id from companies where is_default`)[0];
  const [r] = await sql()`insert into retainers ${sql()({
    company_id: company.id, client_id: d.client_id, name: `${d.data.client.name} retainer`, kind: "support", currency: d.currency,
    day_of_month: Math.min(28, Number(String(d.date).slice(8, 10)) || 1),
    data: sql().json({ lines: d.data.lines, remarks: d.data.remarks, discount: d.data.discount || 0 }),
  } as never)} returning *`;
  await audit(session.user.id, "retainer.create", meta, { from: d.number }, "retainer", r.id);
  return r;
});

// ───────────────────────── projects board ─────────────────────────
async function projectColumns(): Promise<BoardColumn[]> {
  const [row] = await sql()`select value from settings where key = 'project_columns'`;
  return (row?.value as BoardColumn[]) ?? DEFAULT_PROJECT_COLUMNS;
}
const ProjectBody = z.object({
  title: name("Title"), client_id: idRef, status: z.string().max(50).optional(), priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  practice: z.union([practice, z.literal(""), z.null()]).optional().transform((v) => v || null), lead_user_id: idRef,
  start_date: optDate, due_date: optDate,
  budget_amount: z.union([money, z.literal(""), z.null()]).optional().transform((v) => (v === "" || v == null ? null : v)),
  budget_currency: currency.default("NAD"),
  budget_hours: z.union([money, z.literal(""), z.null()]).optional().transform((v) => (v === "" || v == null ? null : v)),
  data: z.object({
    description: text(20000),
    checklist: z.array(z.object({ id: z.string().max(40).optional(), text: text(500), done: z.boolean().default(false) }).transform((c) => ({ ...c, id: c.id || uid() }))).max(200).default([]),
    milestones: z.array(z.object({ id: z.string().max(40).optional(), title: text(300), due: optDate, done: z.boolean().default(false) }).transform((m) => ({ ...m, id: m.id || uid() }))).max(50).default([]),
    tags: z.array(z.string().trim().max(40)).max(20).default([]),
    hours: money.default(0),
  }),
});
route("GET", "/projects", async () => sql()`
  select p.*, c.name as client_name, u.name as lead_name,
    (select count(*)::int from documents d where d.project_id = p.id) as doc_count
  from projects p left join clients c on c.id = p.client_id left join users u on u.id = p.lead_user_id
  order by p.position`);
route("GET", "/projects/:id", async ({ params }) => {
  const pid = id(params.id, "Project");
  const [project] = await sql()`select p.*, c.name as client_name from projects p left join clients c on c.id = p.client_id where p.id = ${pid}`;
  if (!project) throw new HttpError(404, "Project not found.");
  const [documents, activities] = await Promise.all([
    sql()`select id, type, number, status, date, total, currency from documents where project_id = ${pid} order by date desc`,
    sql()`select a.*, u.name as user_name from activities a left join users u on u.id = a.user_id where a.entity = 'project' and a.entity_id = ${pid} order by a.at desc limit 100`,
  ]);
  return { project, documents, activities };
});
route("POST", "/projects", async ({ req, session }) => {
  const b = await parse(req, ProjectBody);
  const cols = await projectColumns();
  const status = b.status && cols.some((c) => c.key === b.status) ? b.status : cols[0].key;
  const [{ p }] = await sql()`select coalesce(max(position), 0) + 1000 as p from projects where status = ${status}`;
  const [proj] = await sql()`insert into projects ${sql()({ ...b, status, position: p, data: sql().json(b.data as never) } as never)} returning *`;
  await logActivity("project", proj.id, "Project created", session.user.id);
  if (proj.client_id) await logActivity("client", proj.client_id, `Project “${proj.title}” created`, session.user.id);
  return proj;
});
route("PUT", "/projects/:id", async ({ req, params, session }) => {
  const pid = id(params.id, "Project");
  const b = await parse(req, ProjectBody);
  const [before] = await sql()`select status from projects where id = ${pid}`;
  if (!before) throw new HttpError(404, "Project not found.");
  const status = b.status ?? before.status;
  const [proj] = await sql()`update projects set ${sql()({ ...b, status, data: sql().json(b.data as never) } as never)}, updated_at = now() where id = ${pid} returning *`;
  if (before.status !== status) await logActivity("project", pid, `Moved to ${(await projectColumns()).find((c) => c.key === status)?.label ?? status}`, session.user.id);
  return proj;
});
route("POST", "/projects/move", async ({ req, session }) => {
  const b = await parse(req, z.object({ id: z.union([z.string(), z.number()]).transform(String), status: z.string().max(50), ids: z.array(z.union([z.string(), z.number()]).transform(String)).max(1000) }));
  const cols = await projectColumns();
  const col = cols.find((c) => c.key === b.status);
  if (!col) throw new HttpError(400, "Unknown board column.");
  const pid = id(b.id, "Project");
  await sql().begin(async (tx) => {
    const [before] = await tx`select status from projects where id = ${pid} for update`;
    if (!before) throw new HttpError(404, "Project not found.");
    await tx`update projects set status = ${b.status}, updated_at = now() where id = ${pid}`;
    for (let i = 0; i < b.ids.length; i++) if (/^\d+$/.test(b.ids[i])) await tx`update projects set position = ${(i + 1) * 1000} where id = ${b.ids[i]} and status = ${b.status}`;
    if (before.status !== b.status) await tx`insert into activities (entity, entity_id, kind, body, user_id) values ('project', ${pid}, 'system', ${"Moved to " + col.label}, ${session.user.id})`;
  });
  return { ok: true };
});
route("DELETE", "/projects/:id", async ({ params }) => {
  const pid = id(params.id, "Project");
  await sql()`delete from activities where entity = 'project' and entity_id = ${pid}`;
  await sql()`delete from projects where id = ${pid}`;
  return { ok: true };
});

// ───────────────────────── settings, users, backup ─────────────────────────
route("GET", "/settings/project_columns", async () => projectColumns());
route("PUT", "/settings/project_columns", async ({ req }) => {
  const cols = await parse(req, z.array(z.object({ key: z.string().max(50).optional(), label: name("Column name", 60), color: z.string().regex(/^#[0-9a-f]{6}$/i).default("#6b7c95") })).min(1, "Keep at least one column.").max(12));
  const out = cols.map((c) => ({ key: (c.key || c.label).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 50) || uid(), label: c.label, color: c.color }));
  if (new Set(out.map((c) => c.key)).size !== out.length) throw new HttpError(400, "Column names must be unique.");
  const used = await sql()`select distinct status from projects`;
  const missing = used.map((r) => r.status as string).filter((s) => !out.some((c) => c.key === s));
  if (missing.length) throw new HttpError(409, `Move the projects out of “${missing.join(", ")}” before removing that column.`);
  await sql()`insert into settings (key, value) values ('project_columns', ${sql().json(out)}) on conflict (key) do update set value = excluded.value, updated_at = now()`;
  return out;
}, { admin: true });

route("GET", "/users", async () => sql()`select id, email, name, role, totp_enabled, disabled, last_login_at,
  (locked_until is not null and locked_until > now()) as locked from users order by id`);
function oneTimePassword() {
  const a = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  return Array.from({ length: 4 }, () => Array.from({ length: 5 }, () => a[randomInt(a.length)]).join("")).join("-");
}
route("POST", "/users", async ({ req, session, meta }) => {
  const b = await parse(req, z.object({ email: z.string().trim().max(254).email("Enter a valid email address."), name: name("Name", 120), role: z.enum(["admin", "member", "readonly"]).default("member") }));
  const pw = oneTimePassword();
  try {
    const [u] = await sql()`insert into users (email, name, role, password_hash) values (${b.email}, ${b.name}, ${b.role}, ${await hashPassword(pw)}) returning id, email`;
    await audit(session.user.id, "user.create", meta, { email: b.email, role: b.role }, "user", u.id);
    return { id: u.id, email: u.email, oneTimePassword: pw };
  } catch (e) {
    if ((e as { code?: string }).code === "23505") throw new HttpError(409, "A user with that email already exists.");
    throw e;
  }
}, { admin: true });
route("PATCH", "/users/:id", async ({ req, params, session, meta }) => {
  const uidp = id(params.id, "User");
  const b = await parse(req, z.object({ role: z.enum(["admin", "member", "readonly"]).optional(), disabled: z.boolean().optional(), name: z.string().trim().min(1).max(120).optional() }));
  if (uidp === session.user.id && (b.disabled || (b.role && b.role !== "admin"))) throw new HttpError(400, "You can't disable or demote yourself.");
  const [u] = await sql()`update users set role = coalesce(${b.role ?? null}, role), disabled = coalesce(${b.disabled ?? null}, disabled),
      name = coalesce(${b.name ?? null}, name), updated_at = now() where id = ${uidp} returning id, role, disabled`;
  if (!u) throw new HttpError(404, "User not found.");
  if (b.disabled) await destroyOtherSessions(uidp, null);
  await audit(session.user.id, "user.update", meta, b, "user", uidp);
  return u;
}, { admin: true });
route("POST", "/users/:id/reset", async ({ req, params, session, meta }) => {
  const uidp = id(params.id, "User");
  if (uidp === session.user.id) throw new HttpError(400, "Use My account to change your own password.");
  const b = await parse(req, z.object({ what: z.enum(["password", "mfa", "unlock"]) }));
  let otp: string | undefined;
  if (b.what === "password") {
    otp = oneTimePassword();
    await sql()`update users set password_hash = ${await hashPassword(otp)}, must_change_password = true, failed_logins = 0, locked_until = null, updated_at = now() where id = ${uidp}`;
  } else if (b.what === "mfa") {
    await sql()`update users set totp_secret = null, totp_enabled = false, totp_last_step = null, updated_at = now() where id = ${uidp}`;
  } else {
    await sql()`update users set failed_logins = 0, locked_until = null, updated_at = now() where id = ${uidp}`;
  }
  if (b.what !== "unlock") await destroyOtherSessions(uidp, null);
  await audit(session.user.id, `user.${b.what}_reset`, meta, {}, "user", uidp);
  return { ok: true, oneTimePassword: otp };
}, { admin: true });

route("GET", "/export", async ({ session, meta }) => {
  const s = sql();
  const [companies, clients, contacts, services, retainers, projects, documents, activities, settings, users, enquiries, opportunities, leads, tasks] = await Promise.all([
    s`select * from companies`, s`select * from clients`, s`select * from contacts`, s`select * from services`, s`select * from retainers`,
    s`select * from projects`, s`select * from documents`, s`select * from activities`, s`select * from settings`,
    s`select id, email, name, role, totp_enabled, disabled, created_at from users`,
    s`select * from enquiries`, s`select * from opportunities`, s`select * from leads`, s`select * from tasks`,
  ]);
  await audit(session.user.id, "backup.export", meta, { documents: documents.length, leads: leads.length });
  return { exported_at: new Date().toISOString(), schema: "auvetric-crm/2", companies, clients, contacts, services, retainers, projects, documents, activities, settings, users, enquiries, opportunities, leads, tasks };
}, { admin: true });

route("POST", "/run-daily", async ({ session, meta }) => {
  const r = await dailyRun();
  await audit(session.user.id, "cron.manual", meta, { created: r.retainers.created.length, overdue: r.overdue });
  return r;
}, { admin: true });

