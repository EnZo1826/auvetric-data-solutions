/**
 * Phase 3 finance rules shared by the API: payment balances, and turning time/expenses into invoice lines.
 * Invariant: documents.amount_paid = sum(payments.amount) for that document, maintained in the same transaction.
 */
import type { TransactionSql } from "postgres";
import { db } from "./db";
import { HttpError } from "./http";
import { saveDocument, type DocInput } from "./documents";
import { todayISO, uid } from "@/crm/shared/calc";
import type { Currency, Line } from "@/crm/shared/types";

type Tx = TransactionSql;
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Re-derives amount_paid and the paid/unpaid status of an invoice from its payments.
 * Fully paid → 'paid' (paid_at = last payment date); a paid invoice that is no longer covered → 'sent' or 'overdue'.
 */
export async function recomputeInvoice(tx: Tx, docId: string) {
  const [d] = await tx`select id, type, status, total, due_date from documents where id = ${docId} for update`;
  if (!d || d.type !== "invoice") return null;
  const [{ paid, last }] = await tx`select coalesce(sum(amount), 0)::numeric as paid, max(date) as last from payments where document_id = ${docId}`;
  const total = Number(d.total), sum = Number(paid);
  let status = d.status as string;
  if (total > 0 && sum >= total && ["sent", "overdue", "paid"].includes(status)) status = "paid";
  else if (status === "paid" && sum < total) status = String(d.due_date) < todayISO() ? "overdue" : "sent";
  const [row] = await tx`update documents set amount_paid = ${sum}, status = ${status},
      paid_at = case when ${status} = 'paid' then coalesce(paid_at, (${last}::date + time '12:00') at time zone 'Africa/Windhoek') else null end,
      updated_at = now()
    where id = ${docId} returning *`;
  return row;
}

/** Releases time entries and expenses whose invoice line was removed from a draft invoice. */
export async function releaseRemovedLines(invoiceId: string, lines: Line[]) {
  const keep = lines.map((l) => l.id).filter(Boolean);
  await db()`update time_entries set invoice_id = null, invoice_line_id = null, updated_at = now()
             where invoice_id = ${invoiceId} and not (invoice_line_id = any(${keep}::text[]))`;
  await db()`update expenses set invoice_id = null, invoice_line_id = null, updated_at = now()
             where invoice_id = ${invoiceId} and not (invoice_line_id = any(${keep}::text[]))`;
}

/**
 * Appends lines to an existing DRAFT invoice of the same client, or creates a new draft invoice.
 * Returns the saved invoice (lines keep the ids passed in, so callers can link source rows).
 */
export async function appendToInvoice(opts: { invoiceId: string | null; clientId: string | null; currency: Currency; lines: Line[]; remarks: string; userId: string }) {
  const sql = db();
  if (opts.invoiceId) {
    const [inv] = await sql`select * from documents where id = ${opts.invoiceId}`;
    if (!inv || inv.type !== "invoice") throw new HttpError(404, "Invoice not found.");
    if (inv.status !== "draft") throw new HttpError(409, "Lines can only be added to a draft invoice.");
    if (opts.clientId && inv.client_id && inv.client_id !== opts.clientId) throw new HttpError(400, "That invoice belongs to another client.");
    if (inv.currency !== opts.currency) throw new HttpError(400, `That invoice is in ${inv.currency}; the selected items are in ${opts.currency}.`);
    const input: DocInput = {
      client_id: inv.client_id, contact_id: inv.contact_id, project_id: inv.project_id, currency: inv.currency, fx_rate: inv.fx_rate,
      date: inv.date, due_date: inv.due_date, status: "draft",
      data: { ...inv.data, lines: [...(inv.data.lines ?? []), ...opts.lines], discount: Number(inv.data.discount || 0), notes: inv.data.notes ?? "", remarks: inv.data.remarks ?? "" },
    } as DocInput;
    return saveDocument(input, opts.userId, inv as never);
  }
  if (!opts.clientId) throw new HttpError(400, "Link the items to a client first.");
  const [co] = await sql`select data from companies where is_default`;
  return saveDocument({
    type: "invoice", client_id: opts.clientId, contact_id: null, project_id: null, currency: opts.currency,
    fx_rate: opts.currency === "NAD" ? null : Number(co.data.usdToNad), status: "draft",
    data: { remarks: opts.remarks, lines: opts.lines, discount: 0, notes: "" },
  } as DocInput, opts.userId);
}

const fmtShort = (iso: string) => new Intl.DateTimeFormat("en-NA", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(iso + "T00:00:00Z"));

type TimeRow = { id: string; date: string; minutes: number; description: string; rate: number; currency: Currency; project_id: string | null; project_title: string | null; user_name: string };

/** Billable time → invoice lines, grouped per project and rate (default) or one line per entry. */
export function timeLines(rows: TimeRow[], group: "project" | "entry"): { lines: Line[]; link: Map<string, string> } {
  const link = new Map<string, string>();
  const lines: Line[] = [];
  if (group === "entry") {
    for (const t of rows) {
      const id = uid();
      link.set(t.id, id);
      lines.push({ id, item: (t.description.split("\n")[0] || t.project_title || "Professional services").slice(0, 300),
        description: `${fmtShort(t.date)} · ${t.user_name}${t.project_title ? ` · ${t.project_title}` : ""}`, unit: "Hour", qty: r2(t.minutes / 60), rate: Number(t.rate) });
    }
    return { lines, link };
  }
  const groups = new Map<string, TimeRow[]>();
  for (const t of rows) {
    const k = `${t.project_id ?? "-"}|${Number(t.rate)}`;
    groups.set(k, [...(groups.get(k) ?? []), t]);
  }
  for (const g of groups.values()) {
    const id = uid();
    g.forEach((t) => link.set(t.id, id));
    const dates = g.map((t) => t.date).sort();
    const minutes = g.reduce((s, t) => s + t.minutes, 0);
    const notes = [...new Set(g.map((t) => t.description.split("\n")[0].trim()).filter(Boolean))];
    lines.push({
      id, item: (g[0].project_title ? `${g[0].project_title}: professional services` : "Professional services").slice(0, 300),
      description: [`${fmtShort(dates[0])}${dates.length > 1 && dates[0] !== dates[dates.length - 1] ? ` – ${fmtShort(dates[dates.length - 1])}` : ""} · ${g.length} entr${g.length === 1 ? "y" : "ies"}`,
        ...notes.slice(0, 12).map((n) => `• ${n}`), notes.length > 12 ? `• and ${notes.length - 12} more` : ""].filter(Boolean).join("\n").slice(0, 4000),
      unit: "Hour", qty: r2(minutes / 60), rate: Number(g[0].rate),
    });
  }
  return { lines, link };
}

/** Expense amount (incl. markup) expressed in the invoice currency. */
export function rebillAmount(e: { amount: number; currency: Currency; fx_rate: number | null; markup_pct: number }, invCurrency: Currency, invFx: number | null) {
  const nad = Number(e.amount) * (e.currency === "NAD" ? 1 : Number(e.fx_rate));
  const withMarkup = nad * (1 + Number(e.markup_pct || 0) / 100);
  return r2(invCurrency === "NAD" ? withMarkup : withMarkup / Number(invFx));
}

/** Client statement per currency: opening balance, invoices (debit) and payments (credit) in the period, ageing at the end date. */
export async function clientStatement(cid: string, fromQ: string | null, toQ: string | null) {
  const sql = db();
  const [client] = await sql`select * from clients where id = ${cid}`;
  if (!client) throw new HttpError(404, "Client not found.");
  const to = toQ ?? todayISO();
  const from = fromQ ?? `${to.slice(0, 4)}-01-01`;
  if (from > to) throw new HttpError(400, "The start date is after the end date.");
  const [company] = await sql`select name, data from companies where is_default`;
  const currencies = (await sql`select distinct currency from documents where client_id = ${cid} and type = 'invoice' and status not in ('draft','cancelled') order by 1`).map((r) => r.currency as Currency);
  const sections = [];
  for (const cur of currencies.length ? currencies : [client.currency as Currency]) {
    const [{ opening }] = await sql`select
        coalesce((select sum(total) from documents where client_id = ${cid} and type = 'invoice' and currency = ${cur} and status not in ('draft','cancelled') and date < ${from}), 0)
      - coalesce((select sum(p.amount) from payments p join documents d on d.id = p.document_id where d.client_id = ${cid} and d.currency = ${cur} and d.status <> 'cancelled' and p.date < ${from}), 0) as opening`;
    const rows = await sql`
      select * from (
        select d.date, 'invoice' as kind, d.number as ref, coalesce(nullif(d.data->>'remarks',''), 'Invoice') as description, d.total as debit, 0::numeric as credit, d.id as doc_id
          from documents d where d.client_id = ${cid} and d.type = 'invoice' and d.currency = ${cur} and d.status not in ('draft','cancelled') and d.date between ${from} and ${to}
        union all
        select p.date, 'payment', d.number, 'Payment received' || case when p.reference <> '' then ' · ' || p.reference else '' end, 0, p.amount, d.id
          from payments p join documents d on d.id = p.document_id where d.client_id = ${cid} and d.currency = ${cur} and d.status <> 'cancelled' and p.date between ${from} and ${to}
      ) t order by date, case kind when 'invoice' then 0 else 1 end, ref`; // same day: invoice before its payment
    let bal = Number(opening);
    const lines = rows.map((t) => { bal = r2(bal + Number(t.debit) - Number(t.credit)); return { date: String(t.date), kind: String(t.kind), ref: String(t.ref), description: String(t.description), doc_id: String(t.doc_id), debit: Number(t.debit), credit: Number(t.credit), balance: bal }; });
    const [age] = await sql`select
        coalesce(sum(total - amount_paid) filter (where ${to}::date - due_date <= 0), 0) as current,
        coalesce(sum(total - amount_paid) filter (where ${to}::date - due_date between 1 and 30), 0) as d30,
        coalesce(sum(total - amount_paid) filter (where ${to}::date - due_date between 31 and 60), 0) as d60,
        coalesce(sum(total - amount_paid) filter (where ${to}::date - due_date between 61 and 90), 0) as d90,
        coalesce(sum(total - amount_paid) filter (where ${to}::date - due_date > 90), 0) as d90plus
      from documents where client_id = ${cid} and type = 'invoice' and currency = ${cur} and status in ('sent','overdue') and date <= ${to}`;
    sections.push({ currency: cur, opening: Number(opening), lines, closing: r2(bal),
      ageing: { current: Number(age.current), d30: Number(age.d30), d60: Number(age.d60), d90: Number(age.d90), d90plus: Number(age.d90plus) } });
  }
  return { client, company, from, to, sections };
}
export type Statement = Awaited<ReturnType<typeof clientStatement>>;
