/** Quotes and invoices: numbering, save rules, retainer generation. Shared by the API and the daily job. */
import { z } from "zod";
import type { TransactionSql } from "postgres";
import { db } from "./db";
import { HttpError } from "./http";
import { addDays, computeTotals, formatDocNumber, todayISO, uid } from "@/crm/shared/calc";
import { INVOICE_STATUSES, QUOTE_STATUSES, type CompanyData, type Currency, type DocType, type Line } from "@/crm/shared/types";
import { currency, idRef, isoDate, LinesZ, money, text } from "./validate";

type Sql = ReturnType<typeof db>;

/** Atomically take the next number for a company (row lock via UPDATE … RETURNING). */
export async function nextNumber(tx: TransactionSql, companyId: string, type: DocType, date: string): Promise<string> {
  const key = type === "invoice" ? "nextInvoice" : "nextQuote";
  const [row] = await tx`
    update companies set data = jsonb_set(data, ${"{" + key + "}"}::text[], to_jsonb(coalesce((data->>${key})::int, 1) + 1)), updated_at = now()
    where id = ${companyId}
    returning (data->>${key})::int - 1 as n, data`;
  if (!row) throw new HttpError(400, "Company not found.");
  const d = row.data as CompanyData;
  const prefix = type === "invoice" ? d.invoicePrefix || "INV-" : d.quotePrefix || "QUO-";
  return formatDocNumber(prefix, Number(row.n), d.numberPad || 4, date);
}

export async function defaultCompany(sql: Sql = db()) {
  const [c] = await sql`select id, name, data from companies where is_default limit 1`;
  if (!c) throw new HttpError(500, "No company profile exists. Run the database migrations.");
  return c as { id: string; name: string; data: CompanyData };
}

export const effectiveVatRate = (cd: CompanyData, requested?: number) =>
  cd.vatRegistered ? Math.min(100, Math.max(0, requested ?? Number(cd.vatRate) ?? 15)) : 0;

export function dueDateFor(type: DocType, cd: CompanyData, date: string, clientTermsDays?: number | null) {
  if (type === "quote") return addDays(date, Number(cd.quoteValidDays) || 30);
  return addDays(date, clientTermsDays ?? (Number(cd.paymentTermsDays) || 14));
}

/** Documents in these states are financially final: only status changes are allowed. */
export const LOCKED = new Set(["paid", "cancelled", "invoiced"]);

export const DocBody = z.object({
  type: z.enum(["invoice", "quote"]).optional(),
  number: z.string().trim().max(60).optional(),
  client_id: idRef,
  contact_id: idRef,
  project_id: idRef,
  status: z.string().max(20).optional(),
  date: isoDate.optional(),
  due_date: isoDate.optional(),
  currency: currency.optional(),
  fx_rate: z.union([money, z.null()]).optional(),
  data: z.object({
    client: z.object({ name: text(300), address: text(1000), email: text(300), phone: text(100), contact: text(200), vat_no: text(100) }).partial().optional(),
    remarks: text(2000),
    lines: LinesZ,
    discount: money.default(0),
    vatRate: money.optional(),
    notes: text(10000),
    proposal: z.object({ intro: text(10000), scope: text(10000), deliverables: text(10000), assumptions: text(10000), timeline: text(10000) }).partial().optional(),
  }).default({ remarks: "", lines: [], discount: 0, notes: "" }),
});
export type DocInput = z.infer<typeof DocBody> & { retainer_id?: string | null; period?: string | null; source_id?: string | null };

type Existing = { id: string; type: DocType; number: string; status: string; company_id: string; date: string; due_date: string; currency: Currency; fx_rate: number | null; client_id: string | null; data: Record<string, unknown>; retainer_id: string | null; period: string | null; source_id: string | null };

/** Create or update a document. All totals are computed here; client totals are never trusted. */
export async function saveDocument(input: DocInput, userId: string | null, existing?: Existing) {
  const sql = db();
  const type: DocType = existing?.type ?? input.type ?? "invoice";
  if (existing && LOCKED.has(existing.status)) throw new HttpError(409, `This ${type} is ${existing.status} and can no longer be edited.`);
  const company = existing ? (await sql`select id, name, data from companies where id = ${existing.company_id}`)[0] as { id: string; data: CompanyData } : await defaultCompany();
  const cd = company.data;

  const clientId = input.client_id ?? null;
  let client: Record<string, unknown> | null = null;
  if (clientId) {
    client = (await sql`select id, name, address, email, phone, vat_no, currency, payment_terms_days from clients where id = ${clientId}`)[0] ?? null;
    if (!client) throw new HttpError(400, "Client not found.");
  }
  let contact: Record<string, unknown> | null = null;
  if (input.contact_id) {
    contact = (await sql`select id, name, email, phone from contacts where id = ${input.contact_id} and client_id = ${clientId}`)[0] ?? null;
    if (!contact) throw new HttpError(400, "That contact doesn't belong to the selected client.");
  }
  if (!contact && clientId) {
    // No contact chosen: address the document to the client's primary contact, if any.
    contact = (await sql`select id, name, email, phone from contacts where client_id = ${clientId} order by is_primary desc, id limit 1`)[0] ?? null;
  }
  if (input.project_id) {
    const [p] = await sql`select id from projects where id = ${input.project_id}`;
    if (!p) throw new HttpError(400, "Project not found.");
  }

  const date = input.date ?? existing?.date ?? todayISO();
  const due = input.due_date ?? (existing && !input.date ? existing.due_date : dueDateFor(type, cd, date, client ? (client.payment_terms_days as number | null) : null));
  if (due < date) throw new HttpError(400, type === "invoice" ? "The due date can't be before the invoice date." : "Valid-until can't be before the quote date.");

  const statuses: readonly string[] = type === "invoice" ? INVOICE_STATUSES : QUOTE_STATUSES;
  const status = input.status && statuses.includes(input.status) ? input.status : existing?.status ?? "draft";
  if (input.status && !statuses.includes(input.status)) throw new HttpError(400, "Invalid status.");

  const cur: Currency = input.currency ?? existing?.currency ?? (client?.currency as Currency) ?? cd.defaultCurrency ?? "NAD";
  const fx = cur === "NAD" ? null : Number(input.fx_rate ?? existing?.fx_rate ?? cd.usdToNad);
  if (cur !== "NAD" && !(fx! > 0)) throw new HttpError(400, "Enter the exchange rate to NAD for this currency.");

  const d = input.data;
  const snapIn = d.client ?? {};
  const snapshot = {
    name: (snapIn.name || (client?.name as string) || "").trim(),
    address: snapIn.address || (client?.address as string) || "",
    email: snapIn.email || (contact?.email as string) || (client?.email as string) || "",
    phone: snapIn.phone || (contact?.phone as string) || (client?.phone as string) || "",
    contact: snapIn.contact || (contact?.name as string) || "",
    vat_no: snapIn.vat_no || (client?.vat_no as string) || "",
  };
  if (!snapshot.name) throw new HttpError(400, "Choose a client or enter the client name.");
  const lines = d.lines as Line[];
  const vatRate = effectiveVatRate(cd, d.vatRate);
  const totals = computeTotals(lines, vatRate, d.discount);
  if (totals.total < 0) throw new HttpError(400, "The discount can't exceed the document total.");
  const data = {
    client: snapshot, remarks: d.remarks, lines, discount: d.discount, vatRate, notes: d.notes,
    ...(type === "quote" ? { proposal: { intro: "", scope: "", deliverables: "", assumptions: "", timeline: "", ...(d.proposal ?? (existing?.data?.proposal as object) ?? {}) } } : {}),
  };
  // The editor always sends the full document, so missing links mean "none".
  const contactId = input.contact_id ?? null;
  const projectId = input.project_id ?? null;

  try {
    return await sql.begin(async (tx) => {
      if (existing) {
        const number = input.number || existing.number;
        const [row] = await tx`
          update documents set number = ${number}, client_id = ${clientId}, contact_id = ${contactId},
            project_id = ${projectId}, status = ${status}, date = ${date}, due_date = ${due},
            currency = ${cur}, fx_rate = ${fx}, data = ${tx.json(data as never)}, subtotal = ${totals.subtotal}, vat = ${totals.vat},
            discount = ${totals.discount}, total = ${totals.total},
            sent_at = case when ${status} in ('sent','paid','overdue','accepted') then coalesce(sent_at, now()) else sent_at end,
            paid_at = case when ${status} = 'paid' then coalesce(paid_at, now()) else null end,
            updated_at = now()
          where id = ${existing.id} returning *`;
        return row;
      }
      const number = input.number || (await nextNumber(tx, company.id, type, date));
      const [row] = await tx`
        insert into documents (type, number, company_id, client_id, contact_id, project_id, retainer_id, source_id, status, date, due_date,
                               period, currency, fx_rate, data, subtotal, vat, discount, total, created_by, sent_at, paid_at)
        values (${type}, ${number}, ${company.id}, ${clientId}, ${contactId}, ${projectId}, ${input.retainer_id ?? null},
                ${input.source_id ?? null}, ${status}, ${date}, ${due}, ${input.period ?? null}, ${cur}, ${fx},
                ${tx.json(data as never)}, ${totals.subtotal}, ${totals.vat}, ${totals.discount}, ${totals.total}, ${userId},
                ${["sent", "paid", "overdue", "accepted"].includes(status) ? tx`now()` : null}, ${status === "paid" ? tx`now()` : null})
        returning *`;
      return row;
    });
  } catch (e) {
    const pg = e as { code?: string; constraint_name?: string };
    if (pg.code === "23505") throw new HttpError(409, pg.constraint_name === "documents_retainer_period" ? "Already invoiced for this month." : "That document number is already used.");
    throw e;
  }
}

export interface GenerateResult {
  period: string;
  created: { id: string; number: string; client: string; total: number; currency: Currency }[];
  skipped: { retainer_id: string; client: string; reason: string }[];
}

/** One draft invoice per active retainer for the month. Idempotent per (retainer, period). */
export async function generateRetainers(period: string, opts: { ids?: string[]; autoOnly?: boolean; userId?: string | null; date?: string } = {}): Promise<GenerateResult> {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw new HttpError(400, "Period must be YYYY-MM.");
  const sql = db();
  const company = await defaultCompany();
  const result: GenerateResult = { period, created: [], skipped: [] };
  const rows = await sql`
    select r.*, c.name as client_name from retainers r join clients c on c.id = r.client_id
    where r.active ${opts.autoOnly ? sql`and r.auto` : sql``} ${opts.ids?.length ? sql`and r.id in ${sql(opts.ids)}` : sql``}
    order by c.name`;
  for (const r of rows) {
    const [dup] = await sql`select number from documents where retainer_id = ${r.id} and period = ${period}`;
    if (dup) { result.skipped.push({ retainer_id: r.id, client: r.client_name, reason: `Already invoiced (${dup.number})` }); continue; }
    const date = opts.date ?? `${period}-${String(r.day_of_month).padStart(2, "0")}`;
    const lines = ((r.data?.lines ?? []) as Line[]).map((l) => ({ ...l, id: uid() }));
    if (!lines.length) { result.skipped.push({ retainer_id: r.id, client: r.client_name, reason: "No lines on this retainer" }); continue; }
    try {
      const doc = await saveDocument({
        type: "invoice", client_id: r.client_id, contact_id: null, project_id: null, currency: r.currency, fx_rate: r.currency === "NAD" ? null : company.data.usdToNad,
        date, retainer_id: r.id, period,
        data: { remarks: r.data?.remarks || `${r.name} — ${period}`, lines, discount: Number(r.data?.discount || 0), notes: "" },
      } as DocInput, opts.userId ?? null);
      await sql`update retainers set last_period = ${period}, updated_at = now() where id = ${r.id}`;
      result.created.push({ id: doc.id, number: doc.number, client: r.client_name, total: Number(doc.total), currency: doc.currency });
    } catch (e) {
      const msg = e instanceof HttpError ? e.message : (e as { code?: string }).code === "23505" ? "Already invoiced" : "Failed";
      if (!(e instanceof HttpError) && (e as { code?: string }).code !== "23505") console.error("[crm] retainer", r.id, e);
      result.skipped.push({ retainer_id: r.id, client: r.client_name, reason: msg });
    }
  }
  return result;
}

/** Daily: generate due auto-retainers, flag overdue invoices. */
export async function dailyRun(now = new Date()) {
  const today = todayISO(now);
  const day = Number(today.slice(8, 10));
  const period = today.slice(0, 7);
  const sql = db();
  const due = await sql`select id from retainers where active and auto and day_of_month <= ${day} and (last_period is null or last_period < ${period})`;
  const gen = due.length ? await generateRetainers(period, { ids: due.map((r) => String(r.id)), autoOnly: true }) : { period, created: [], skipped: [] };
  const overdue = await sql`update documents set status = 'overdue', updated_at = now()
                            where type = 'invoice' and status = 'sent' and due_date < ${today} returning id`;
  return { today, retainers: gen, overdue: overdue.length };
}
