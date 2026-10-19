/** CRM JSON API · Phase 3 finance: payments, debtors ageing, statements, time, expenses, marketplace earnings. */
import { z } from "zod";
import { db } from "../db";
import { audit, HttpError } from "../http";
import { id, route } from "../router";
import { currency, idRef, isoDate, money, text } from "../validate";
import { logActivity, parse } from "./routes";
import { appendToInvoice, clientStatement, rebillAmount, recomputeInvoice, timeLines } from "../finance";
import { todayISO, uid } from "@/crm/shared/calc";
import type { Currency, Line } from "@/crm/shared/types";

const sql = () => db();
const dateQ = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const idQ = (v: string | null) => (v && /^\d{1,18}$/.test(v) ? v : null);
const optFx = z.union([money, z.literal(""), z.null()]).optional().transform((v) => (v === "" || v == null ? null : Number(v)));
const fxRule = (c: Currency, fx: number | null) => { if (c !== "NAD" && !(Number(fx) > 0)) throw new HttpError(400, "Enter the exchange rate to NAD."); return c === "NAD" ? null : fx; };

// ───────────────────────── payments ─────────────────────────
export const PAYMENT_METHODS = ["eft", "cash", "card", "upwork", "paypal", "wise", "other"] as const;
const PaymentBody = z.object({
  document_id: z.union([z.string(), z.number()]).transform(String), date: isoDate, amount: money.refine((n) => n > 0, "Enter an amount above zero."),
  method: z.enum(PAYMENT_METHODS).default("eft"), reference: text(200), notes: text(2000),
});
route("GET", "/payments", async ({ query }) => {
  const s = sql();
  const from = dateQ(query.get("from")), to = dateQ(query.get("to")), client = idQ(query.get("client_id"));
  return s`select p.*, d.number, d.currency, d.client_id, d.data->'client'->>'name' as client_name, u.name as created_by_name
    from payments p join documents d on d.id = p.document_id left join users u on u.id = p.created_by where true
    ${from ? s`and p.date >= ${from}` : s``} ${to ? s`and p.date <= ${to}` : s``} ${client ? s`and d.client_id = ${client}` : s``}
    order by p.date desc, p.id desc limit 2000`;
});
route("GET", "/documents/:id/payments", async ({ params }) =>
  sql()`select p.*, u.name as created_by_name from payments p left join users u on u.id = p.created_by where p.document_id = ${id(params.id, "Document")} order by p.date, p.id`);
route("POST", "/payments", async ({ req, session, meta }) => {
  const b = await parse(req, PaymentBody);
  const docId = id(b.document_id, "Invoice");
  const out = await sql().begin(async (tx) => {
    const [d] = await tx`select id, type, status, number, total, amount_paid, client_id, currency from documents where id = ${docId} for update`;
    if (!d || d.type !== "invoice") throw new HttpError(404, "Invoice not found.");
    if (d.status === "draft") throw new HttpError(409, "Mark the invoice as sent before recording a payment.");
    if (d.status === "cancelled") throw new HttpError(409, "This invoice is cancelled.");
    await tx`delete from payments where document_id = ${docId} and auto`; // a real payment replaces a "Mark paid" placeholder
    const [{ paid }] = await tx`select coalesce(sum(amount), 0)::numeric as paid from payments where document_id = ${docId}`;
    const balance = Math.round((Number(d.total) - Number(paid)) * 100) / 100;
    if (b.amount > balance + 0.004) throw new HttpError(400, `That is more than the balance due (${d.currency} ${balance.toFixed(2)}).`);
    if (b.date > todayISO()) throw new HttpError(400, "A payment can't be dated in the future.");
    const [p] = await tx`insert into payments ${tx({ ...b, document_id: docId, created_by: session.user.id } as never)} returning *`;
    const doc = await recomputeInvoice(tx, docId);
    return { payment: p, invoice: doc, d };
  });
  await audit(session.user.id, "payment.create", meta, { number: out.d.number, amount: b.amount, method: b.method }, "document", docId);
  await logActivity("client", out.d.client_id, `Payment of ${out.d.currency} ${b.amount.toFixed(2)} received on ${out.d.number}${out.invoice?.status === "paid" ? " (paid in full)" : ""}`, session.user.id);
  return out.invoice ? { ...out.payment, invoice: out.invoice } : out.payment;
});
route("DELETE", "/payments/:id", async ({ params, session, meta }) => {
  const pid = id(params.id, "Payment");
  const out = await sql().begin(async (tx) => {
    const [p] = await tx`delete from payments where id = ${pid} returning *`;
    if (!p) throw new HttpError(404, "Payment not found.");
    const doc = await recomputeInvoice(tx, p.document_id);
    return { p, doc };
  });
  await audit(session.user.id, "payment.delete", meta, { number: out.doc?.number, amount: out.p.amount }, "document", out.p.document_id);
  return { ok: true, invoice: out.doc };
});

// ───────────────────────── debtors ageing ─────────────────────────
/** Open invoice balances per client in ageing buckets by days past due (as of today, Windhoek). */
route("GET", "/debtors", async ({ query }) => {
  const asOf = dateQ(query.get("as_of")) ?? todayISO();
  const rows = await sql()`
    select d.id, d.number, d.client_id, coalesce(c.name, d.data->'client'->>'name') as client_name, d.date, d.due_date, d.currency, d.fx_rate,
           d.total, d.amount_paid, (d.total - d.amount_paid) as balance, (${asOf}::date - d.due_date) as days_overdue
    from documents d left join clients c on c.id = d.client_id
    where d.type = 'invoice' and d.status in ('sent','overdue') and d.total - d.amount_paid > 0 and d.date <= ${asOf}
    order by client_name, d.due_date`;
  const bucket = (days: number) => (days <= 0 ? "current" : days <= 30 ? "d30" : days <= 60 ? "d60" : days <= 90 ? "d90" : "d90plus");
  type Row = { client_id: string | null; client_name: string; currency: string; current: number; d30: number; d60: number; d90: number; d90plus: number; total: number; total_nad: number; invoices: Record<string, unknown>[] };
  const clients = new Map<string, Row>();
  for (const r of rows) {
    const key = `${r.client_id ?? r.client_name}|${r.currency}`;
    const c: Row = clients.get(key) ?? { client_id: r.client_id, client_name: r.client_name, currency: r.currency, current: 0, d30: 0, d60: 0, d90: 0, d90plus: 0, total: 0, total_nad: 0, invoices: [] };
    const bal = Number(r.balance);
    c[bucket(Number(r.days_overdue))] += bal;
    c.total += bal;
    c.total_nad += r.currency === "NAD" ? bal : bal * Number(r.fx_rate);
    c.invoices.push({ id: r.id, number: r.number, date: r.date, due_date: r.due_date, total: Number(r.total), balance: bal, days_overdue: Number(r.days_overdue) });
    clients.set(key, c);
  }
  const list = [...clients.values()].map((c) => ({ ...c, ...Object.fromEntries(["current", "d30", "d60", "d90", "d90plus", "total", "total_nad"].map((k) => [k, Math.round((c as never as Record<string, number>)[k] * 100) / 100])) }));
  return { as_of: asOf, clients: list.sort((a, b) => b.total_nad - a.total_nad) };
});

// ───────────────────────── client statement ─────────────────────────
route("GET", "/clients/:id/statement", async ({ params, query }) =>
  clientStatement(id(params.id, "Client"), dateQ(query.get("from")), dateQ(query.get("to"))));

// ───────────────────────── time tracking ─────────────────────────
const TimeBody = z.object({
  date: isoDate, project_id: idRef, client_id: idRef, minutes: z.coerce.number().int().min(1, "Enter the time spent.").max(1440, "At most 24 hours per entry."),
  description: text(2000), billable: z.boolean().default(true),
  rate: z.union([money, z.literal(""), z.null()]).optional().transform((v) => (v === "" || v == null ? null : Number(v))),
  currency: currency.default("NAD"), user_id: idRef,
});
async function timeFields(b: z.infer<typeof TimeBody>, sessionUser: { id: string; role: string }) {
  let clientId = b.client_id;
  if (b.project_id) {
    const [p] = await sql()`select client_id from projects where id = ${b.project_id}`;
    if (!p) throw new HttpError(400, "Project not found.");
    clientId = p.client_id ?? clientId;
  }
  if (b.billable && !(Number(b.rate) > 0)) throw new HttpError(400, "Billable time needs an hourly rate.");
  if (b.billable && !clientId) throw new HttpError(400, "Billable time must belong to a client or a project with a client.");
  const userId = b.user_id && sessionUser.role === "admin" ? b.user_id : sessionUser.id;
  return { date: b.date, project_id: b.project_id, client_id: clientId, minutes: b.minutes, description: b.description, billable: b.billable,
    rate: b.billable ? b.rate : b.rate ?? null, currency: b.currency, user_id: userId };
}
route("GET", "/time", async ({ query, session }) => {
  const s = sql();
  const from = dateQ(query.get("from")), to = dateQ(query.get("to"));
  const user = query.get("user"), project = idQ(query.get("project_id")), client = idQ(query.get("client_id")), status = query.get("status");
  return s`select t.*, u.name as user_name, p.title as project_title, c.name as client_name, d.number as invoice_number
    from time_entries t join users u on u.id = t.user_id left join projects p on p.id = t.project_id left join clients c on c.id = t.client_id
    left join documents d on d.id = t.invoice_id where true
    ${from ? s`and t.date >= ${from}` : s``} ${to ? s`and t.date <= ${to}` : s``}
    ${user === "me" ? s`and t.user_id = ${session.user.id}` : idQ(user) ? s`and t.user_id = ${user}` : s``}
    ${project ? s`and t.project_id = ${project}` : s``} ${client ? s`and t.client_id = ${client}` : s``}
    ${status === "unbilled" ? s`and t.billable and t.invoice_id is null` : status === "billed" ? s`and t.invoice_id is not null` : status === "nonbillable" ? s`and not t.billable` : s``}
    order by t.date desc, t.id desc limit 3000`;
});
route("POST", "/time", async ({ req, session }) => {
  const f = await timeFields(await parse(req, TimeBody), session.user);
  const [t] = await sql()`insert into time_entries ${sql()(f as never)} returning *`;
  return t;
});
async function editableTime(tid: string, session: { user: { id: string; role: string } }) {
  const [t] = await sql()`select * from time_entries where id = ${tid}`;
  if (!t) throw new HttpError(404, "Time entry not found.");
  if (t.invoice_id) throw new HttpError(409, "This time is on an invoice. Remove the line from the draft invoice first.");
  if (t.user_id !== session.user.id && session.user.role !== "admin") throw new HttpError(403, "You can only change your own time.");
  return t;
}
route("PUT", "/time/:id", async ({ req, params, session }) => {
  const tid = id(params.id, "Time entry");
  await editableTime(tid, session);
  const f = await timeFields(await parse(req, TimeBody), session.user);
  const [t] = await sql()`update time_entries set ${sql()(f as never)}, updated_at = now() where id = ${tid} returning *`;
  return t;
});
route("DELETE", "/time/:id", async ({ params, session }) => {
  const tid = id(params.id, "Time entry");
  await editableTime(tid, session);
  await sql()`delete from time_entries where id = ${tid}`;
  return { ok: true };
});
route("POST", "/time/invoice", async ({ req, session, meta }) => {
  const b = await parse(req, z.object({ ids: z.array(z.union([z.string(), z.number()]).transform(String)).min(1, "Select time to invoice.").max(1000),
    invoice_id: idRef, group: z.enum(["project", "entry"]).default("project") }));
  const ids = b.ids.filter((x) => /^\d{1,18}$/.test(x));
  const rows = await sql()`select t.id, t.date, t.minutes, t.description, t.rate, t.currency, t.project_id, t.client_id, t.billable, t.invoice_id,
      p.title as project_title, u.name as user_name
    from time_entries t join users u on u.id = t.user_id left join projects p on p.id = t.project_id where t.id in ${sql()(ids)} order by t.date, t.id`;
  if (rows.length !== ids.length) throw new HttpError(404, "Some time entries no longer exist.");
  if (rows.some((r) => !r.billable)) throw new HttpError(400, "Non-billable time can't be invoiced.");
  if (rows.some((r) => r.invoice_id)) throw new HttpError(409, "Some of that time is already on an invoice.");
  const clients = [...new Set(rows.map((r) => r.client_id))];
  if (clients.length !== 1 || !clients[0]) throw new HttpError(400, "Select time for one client at a time.");
  const curs = [...new Set(rows.map((r) => r.currency))];
  if (curs.length !== 1) throw new HttpError(400, "Select time in one currency at a time.");
  const { lines, link } = timeLines(rows as never, b.group);
  const inv = await appendToInvoice({ invoiceId: b.invoice_id, clientId: clients[0], currency: curs[0] as Currency, lines, remarks: "Professional services", userId: session.user.id });
  await sql().begin(async (tx) => {
    for (const [tid, lineId] of link) await tx`update time_entries set invoice_id = ${inv.id}, invoice_line_id = ${lineId}, updated_at = now() where id = ${tid} and invoice_id is null`;
  });
  await audit(session.user.id, "time.invoice", meta, { number: inv.number, entries: ids.length }, "document", inv.id);
  return inv;
});

// ───────────────────────── expenses ─────────────────────────
export const EXPENSE_CATEGORIES = ["hosting", "software", "hardware", "travel", "subcontractor", "fees", "office", "other"] as const;
const ExpenseBody = z.object({
  date: isoDate, supplier: text(200), category: z.enum(EXPENSE_CATEGORIES).default("other"), description: text(2000),
  amount: money.refine((n) => n > 0, "Enter the amount paid."), vat_amount: money.default(0), currency: currency.default("NAD"), fx_rate: optFx,
  client_id: idRef, project_id: idRef, billable: z.boolean().default(false), markup_pct: z.coerce.number().min(0).max(500).default(0),
  receipt_ref: text(300), paid_by_user_id: idRef, notes: text(4000),
});
async function expenseFields(b: z.infer<typeof ExpenseBody>) {
  if (b.vat_amount > b.amount) throw new HttpError(400, "VAT can't exceed the amount.");
  let clientId = b.client_id;
  if (b.project_id) {
    const [p] = await sql()`select client_id from projects where id = ${b.project_id}`;
    if (!p) throw new HttpError(400, "Project not found.");
    clientId = clientId ?? p.client_id;
  }
  if (b.billable && !clientId) throw new HttpError(400, "Choose the client to re-bill.");
  return { ...b, client_id: clientId, fx_rate: fxRule(b.currency, b.fx_rate) };
}
route("GET", "/expenses", async ({ query }) => {
  const s = sql();
  const from = dateQ(query.get("from")), to = dateQ(query.get("to")), client = idQ(query.get("client_id"));
  const cat = query.get("category"), status = query.get("status");
  return s`select e.*, c.name as client_name, p.title as project_title, d.number as invoice_number, u.name as paid_by_name
    from expenses e left join clients c on c.id = e.client_id left join projects p on p.id = e.project_id
    left join documents d on d.id = e.invoice_id left join users u on u.id = e.paid_by_user_id where true
    ${from ? s`and e.date >= ${from}` : s``} ${to ? s`and e.date <= ${to}` : s``} ${client ? s`and e.client_id = ${client}` : s``}
    ${cat && (EXPENSE_CATEGORIES as readonly string[]).includes(cat) ? s`and e.category = ${cat}` : s``}
    ${status === "unbilled" ? s`and e.billable and e.invoice_id is null` : s``}
    order by e.date desc, e.id desc limit 3000`;
});
route("POST", "/expenses", async ({ req, session, meta }) => {
  const f = await expenseFields(await parse(req, ExpenseBody));
  const [e] = await sql()`insert into expenses ${sql()({ ...f, created_by: session.user.id } as never)} returning *`;
  await audit(session.user.id, "expense.create", meta, { amount: e.amount, currency: e.currency, supplier: e.supplier }, "expense", e.id);
  return e;
});
route("PUT", "/expenses/:id", async ({ req, params, session, meta }) => {
  const eid = id(params.id, "Expense");
  const [cur] = await sql()`select invoice_id from expenses where id = ${eid}`;
  if (!cur) throw new HttpError(404, "Expense not found.");
  if (cur.invoice_id) throw new HttpError(409, "This expense is on an invoice. Remove the line from the draft invoice first.");
  const f = await expenseFields(await parse(req, ExpenseBody));
  const [e] = await sql()`update expenses set ${sql()(f as never)}, updated_at = now() where id = ${eid} returning *`;
  await audit(session.user.id, "expense.update", meta, { amount: e.amount, currency: e.currency }, "expense", eid);
  return e;
});
route("DELETE", "/expenses/:id", async ({ params, session, meta }) => {
  const eid = id(params.id, "Expense");
  const [e] = await sql()`delete from expenses where id = ${eid} and invoice_id is null returning amount, currency`;
  if (!e) throw new HttpError(409, "Expense not found, or it is on an invoice.");
  await audit(session.user.id, "expense.delete", meta, e, "expense", eid);
  return { ok: true };
});
route("POST", "/expenses/rebill", async ({ req, session, meta }) => {
  const b = await parse(req, z.object({ ids: z.array(z.union([z.string(), z.number()]).transform(String)).min(1, "Select expenses to re-bill.").max(500), invoice_id: idRef }));
  const ids = b.ids.filter((x) => /^\d{1,18}$/.test(x));
  const rows = await sql()`select * from expenses where id in ${sql()(ids)} order by date, id`;
  if (rows.length !== ids.length) throw new HttpError(404, "Some expenses no longer exist.");
  if (rows.some((r) => !r.billable)) throw new HttpError(400, "Only billable expenses can be re-billed.");
  if (rows.some((r) => r.invoice_id)) throw new HttpError(409, "Some of these expenses are already on an invoice.");
  const clients = [...new Set(rows.map((r) => r.client_id))];
  if (clients.length !== 1) throw new HttpError(400, "Select expenses for one client at a time.");
  let invCurrency: Currency, invFx: number | null;
  if (b.invoice_id) {
    const [inv] = await sql()`select currency, fx_rate from documents where id = ${b.invoice_id}`;
    if (!inv) throw new HttpError(404, "Invoice not found.");
    invCurrency = inv.currency; invFx = inv.fx_rate;
  } else {
    const [[c], [co]] = await Promise.all([sql()`select currency from clients where id = ${clients[0]}`, sql()`select data from companies where is_default`]);
    invCurrency = c.currency; invFx = invCurrency === "NAD" ? null : Number(co.data.usdToNad);
  }
  const link = new Map<string, string>();
  const lines: Line[] = rows.map((e) => {
    const lid = uid();
    link.set(e.id, lid);
    return { id: lid, item: `Re-billed: ${e.supplier || e.category}`.slice(0, 300),
      description: [e.description, e.currency !== invCurrency ? `Original ${e.currency} ${Number(e.amount).toFixed(2)}` : "", Number(e.markup_pct) ? `Incl. ${Number(e.markup_pct)}% handling` : ""].filter(Boolean).join(" · ").slice(0, 4000),
      unit: "Each", qty: 1, rate: rebillAmount(e as never, invCurrency, invFx) };
  });
  const inv = await appendToInvoice({ invoiceId: b.invoice_id, clientId: clients[0], currency: invCurrency, lines, remarks: "Re-billed expenses", userId: session.user.id });
  await sql().begin(async (tx) => {
    for (const [eid, lineId] of link) await tx`update expenses set invoice_id = ${inv.id}, invoice_line_id = ${lineId}, updated_at = now() where id = ${eid} and invoice_id is null`;
  });
  await audit(session.user.id, "expense.rebill", meta, { number: inv.number, expenses: ids.length }, "document", inv.id);
  return inv;
});

// ───────────────────────── marketplace earnings ─────────────────────────
export const PLATFORMS = ["upwork", "fiverr", "freelancer", "other"] as const;
const EarningBody = z.object({
  platform: z.enum(PLATFORMS).default("upwork"), date: isoDate, client_name: text(200), client_id: idRef, project_id: idRef,
  contract: text(300), description: text(2000), gross: money.refine((n) => n >= 0, "Gross can't be negative."), fee: money.default(0),
  currency: currency.default("USD"), fx_rate: optFx, reference: text(200),
});
async function earningFields(b: z.infer<typeof EarningBody>) {
  if (b.fee > b.gross) throw new HttpError(400, "The fee can't exceed the gross amount.");
  return { ...b, fx_rate: fxRule(b.currency, b.fx_rate) };
}
route("GET", "/marketplace", async ({ query }) => {
  const s = sql();
  const from = dateQ(query.get("from")), to = dateQ(query.get("to"));
  return s`select m.*, (m.gross - m.fee) as net, c.name as linked_client_name, p.title as project_title
    from marketplace_earnings m left join clients c on c.id = m.client_id left join projects p on p.id = m.project_id where true
    ${from ? s`and m.date >= ${from}` : s``} ${to ? s`and m.date <= ${to}` : s``} order by m.date desc, m.id desc limit 3000`;
});
route("POST", "/marketplace", async ({ req, session, meta }) => {
  const f = await earningFields(await parse(req, EarningBody));
  const [m] = await sql()`insert into marketplace_earnings ${sql()({ ...f, created_by: session.user.id } as never)} returning *`;
  await audit(session.user.id, "marketplace.create", meta, { platform: m.platform, gross: m.gross, currency: m.currency }, "marketplace", m.id);
  return m;
});
route("PUT", "/marketplace/:id", async ({ req, params, session, meta }) => {
  const mid = id(params.id, "Earning");
  const f = await earningFields(await parse(req, EarningBody));
  const [m] = await sql()`update marketplace_earnings set ${sql()(f as never)}, updated_at = now() where id = ${mid} returning *`;
  if (!m) throw new HttpError(404, "Earning not found.");
  await audit(session.user.id, "marketplace.update", meta, { gross: m.gross, fee: m.fee }, "marketplace", mid);
  return m;
});
route("DELETE", "/marketplace/:id", async ({ params, session, meta }) => {
  const mid = id(params.id, "Earning");
  const [m] = await sql()`delete from marketplace_earnings where id = ${mid} returning gross, currency`;
  if (!m) throw new HttpError(404, "Earning not found.");
  await audit(session.user.id, "marketplace.delete", meta, m, "marketplace", mid);
  return { ok: true };
});

// Draft invoices of a client, for "add to existing draft" pickers.
route("GET", "/clients/:id/draft-invoices", async ({ params }) =>
  sql()`select id, number, currency, date, total from documents where client_id = ${id(params.id, "Client")} and type = 'invoice' and status = 'draft' order by date desc`);
