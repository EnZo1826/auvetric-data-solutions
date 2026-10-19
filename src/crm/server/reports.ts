/**
 * Reports for a date range, all money in NAD (USD converted at each record's own rate; open leads and retainers at
 * the company default rate). Revenue = invoices issued (sent, paid or overdue) excluding VAT, by invoice date.
 * Practice split allocates each invoice's revenue over its lines (service practice → project practice → unassigned);
 * partner = the project lead, else whoever created the invoice. Every breakdown sums back to its headline figure.
 */
import { db } from "./db";
import { HttpError } from "./http";
import type { CompanyData } from "@/crm/shared/types";

const r2 = (n: number) => Math.round(n * 100) / 100;
const STAGE_P: Record<string, number> = { new: 10, qualified: 25, discovery: 40, proposal: 60, negotiation: 80 };
const OPEN = ["new", "qualified", "discovery", "proposal", "negotiation"];

export function monthsBetween(from: string, to: string) {
  const out: string[] = [];
  let [y, m] = from.slice(0, 7).split("-").map(Number);
  const end = to.slice(0, 7);
  while (out.length < 60) {
    const k = `${y}-${String(m).padStart(2, "0")}`;
    out.push(k);
    if (k >= end) break;
    if (++m > 12) { m = 1; y++; }
  }
  return out;
}
export function weekdays(from: string, to: string) {
  let n = 0;
  for (let t = Date.parse(from + "T00:00:00Z"), e = Date.parse(to + "T00:00:00Z"); t <= e; t += 864e5) { const d = new Date(t).getUTCDay(); if (d !== 0 && d !== 6) n++; }
  return n;
}

export async function buildReports(from: string, to: string) {
  if (from > to) throw new HttpError(400, "The start date is after the end date.");
  if (Date.parse(to) - Date.parse(from) > 3 * 366 * 864e5) throw new HttpError(400, "Choose a period of at most three years.");
  const sql = db();
  const [company] = await sql`select data from companies where is_default`;
  const cd = (company?.data ?? {}) as CompanyData;
  const usd = Number(cd.usdToNad) || 0;
  const conv = (amount: number, currency: string, fx: number | null) => amount * (currency === "NAD" ? 1 : Number(fx ?? usd));

  const [invoices, services, projects, users, clients] = await Promise.all([
    sql`select id, number, date, currency, fx_rate, total, vat, data->'lines' as lines, project_id, client_id, created_by, data->'client'->>'name' as snap_name
        from documents where type = 'invoice' and status in ('sent','paid','overdue') and date between ${from} and ${to}`,
    sql`select id, practice from services`,
    sql`select id, title, practice, lead_user_id, client_id, budget_hours from projects`,
    sql`select id, name, weekly_hours, disabled from users order by name`,
    sql`select id, name from clients`,
  ]);
  const svc = new Map(services.map((s) => [String(s.id), s.practice as string]));
  const proj = new Map(projects.map((p) => [String(p.id), p]));
  const userName = new Map(users.map((u) => [String(u.id), u.name as string]));
  const clientName = new Map(clients.map((c) => [String(c.id), c.name as string]));

  // ── revenue ──
  const byPractice: Record<string, number> = {}, byPartner: Record<string, number> = {}, byClient: Record<string, { name: string; invoiced: number; received: number }> = {};
  const monthly: Record<string, { invoiced: number; received: number; marketplace: number; expenses: number }> = {};
  for (const k of monthsBetween(from, to)) monthly[k] = { invoiced: 0, received: 0, marketplace: 0, expenses: 0 };
  let invoiced = 0;
  for (const d of invoices) {
    const rev = conv(Number(d.total) - Number(d.vat), d.currency, d.fx_rate);
    invoiced += rev;
    monthly[String(d.date).slice(0, 7)].invoiced += rev;
    const p = d.project_id ? proj.get(String(d.project_id)) : null;
    const lines = (d.lines ?? []) as { qty: number; rate: number; service_id?: string | number | null }[];
    const amts = lines.map((l) => Math.round(Number(l.qty) * Number(l.rate) * 100) / 100);
    const sub = amts.reduce((a, b) => a + b, 0);
    if (sub === 0) byPractice.unassigned = (byPractice.unassigned ?? 0) + rev;
    else lines.forEach((l, i) => {
      const k = (l.service_id != null && svc.get(String(l.service_id))) || p?.practice || "unassigned";
      byPractice[k] = (byPractice[k] ?? 0) + (rev * amts[i]) / sub;
    });
    const partner = String(p?.lead_user_id ?? d.created_by ?? "");
    byPartner[partner] = (byPartner[partner] ?? 0) + rev;
    const ck = String(d.client_id ?? `snap:${d.snap_name}`);
    (byClient[ck] ??= { name: d.client_id ? clientName.get(String(d.client_id)) ?? d.snap_name : d.snap_name, invoiced: 0, received: 0 }).invoiced += rev;
  }

  const pays = await sql`select p.date, p.amount, d.currency, d.fx_rate, d.client_id, d.data->'client'->>'name' as snap_name
    from payments p join documents d on d.id = p.document_id where d.status <> 'cancelled' and p.date between ${from} and ${to}`;
  let received = 0;
  for (const p of pays) {
    const v = conv(Number(p.amount), p.currency, p.fx_rate);
    received += v;
    monthly[String(p.date).slice(0, 7)].received += v;
    const ck = String(p.client_id ?? `snap:${p.snap_name}`);
    (byClient[ck] ??= { name: p.client_id ? clientName.get(String(p.client_id)) ?? p.snap_name : p.snap_name, invoiced: 0, received: 0 }).received += v;
  }
  const market = await sql`select date, platform, gross, fee, gross - fee as net, currency, fx_rate from marketplace_earnings where date between ${from} and ${to}`;
  let marketplace = 0;
  const byPlatform: Record<string, { gross: number; fee: number; net: number }> = {};
  for (const m of market) {
    const net = conv(Number(m.net), m.currency, m.fx_rate);
    marketplace += net;
    monthly[String(m.date).slice(0, 7)].marketplace += net;
    const s = (byPlatform[m.platform] ??= { gross: 0, fee: 0, net: 0 });
    s.gross += conv(Number(m.gross), m.currency, m.fx_rate); s.fee += conv(Number(m.fee), m.currency, m.fx_rate); s.net += net;
  }
  const exps = await sql`select date, category, amount, vat_amount, currency, fx_rate from expenses where date between ${from} and ${to}`;
  let expenses = 0;
  const byCategory: Record<string, number> = {};
  for (const e of exps) {
    const v = conv(Number(e.amount), e.currency, e.fx_rate);
    expenses += v;
    monthly[String(e.date).slice(0, 7)].expenses += v;
    byCategory[e.category] = (byCategory[e.category] ?? 0) + v;
  }
  const open = await sql`select client_id, currency, fx_rate, total - amount_paid as bal, due_date from documents where type = 'invoice' and status in ('sent','overdue')`;
  const outstanding: Record<string, number> = {};
  let debtorsTotal = 0, debtorsOverdue = 0;
  const today = new Date(Date.now() + 2 * 3600e3).toISOString().slice(0, 10);
  for (const o of open) {
    const v = conv(Number(o.bal), o.currency, o.fx_rate);
    debtorsTotal += v;
    if (String(o.due_date) < today) debtorsOverdue += v;
    if (o.client_id) outstanding[String(o.client_id)] = (outstanding[String(o.client_id)] ?? 0) + v;
  }

  // ── recurring ──
  const rets = await sql`select kind, currency, data from retainers where active`;
  const byKind: Record<string, { count: number; nad: number }> = {};
  let mrr = 0;
  for (const r of rets) {
    const lines = (r.data?.lines ?? []) as { qty: number; rate: number }[];
    const v = conv(lines.reduce((a, l) => a + Math.round(Number(l.qty) * Number(l.rate) * 100) / 100, 0) - Number(r.data?.discount ?? 0), r.currency, null);
    mrr += v;
    const k = (byKind[r.kind] ??= { count: 0, nad: 0 }); k.count++; k.nad += v;
  }

  // ── sales ──
  const leads = await sql`select stage, source, value, currency, probability, closed_at from leads`;
  const pipeline = OPEN.map((stage) => {
    const ls = leads.filter((l) => l.stage === stage);
    const value = ls.reduce((a, l) => a + conv(Number(l.value ?? 0), l.currency, null), 0);
    const weighted = ls.reduce((a, l) => a + (conv(Number(l.value ?? 0), l.currency, null) * Number(l.probability ?? STAGE_P[stage])) / 100, 0);
    return { stage, count: ls.length, value_nad: r2(value), weighted_nad: r2(weighted) };
  });
  const toEnd = new Date(Date.parse(to + "T00:00:00Z") + 864e5 - 2 * 3600e3); // end of `to` in Windhoek
  const fromStart = new Date(Date.parse(from + "T00:00:00Z") - 2 * 3600e3);
  const closed = leads.filter((l) => (l.stage === "won" || l.stage === "lost") && l.closed_at && new Date(l.closed_at) >= fromStart && new Date(l.closed_at) < toEnd);
  const sources = [...new Set(closed.map((l) => l.source as string))].sort();
  const winRate = sources.map((source) => {
    const s = closed.filter((l) => l.source === source);
    const won = s.filter((l) => l.stage === "won");
    return { source, won: won.length, lost: s.length - won.length, rate: s.length ? Math.round((won.length / s.length) * 100) : 0, won_value_nad: r2(won.reduce((a, l) => a + conv(Number(l.value ?? 0), l.currency, null), 0)) };
  });
  const opps = await sql`select source, count(*)::int as received,
      count(*) filter (where status in ('applied','interviewing','won','lost'))::int as applied,
      count(*) filter (where status = 'won')::int as won, round(avg(fit_score))::int as avg_fit
    from opportunities where received_at >= ${fromStart} and received_at < ${toEnd} group by source order by received desc`;
  const [enq] = await sql`select count(*)::int as received, count(*) filter (where status = 'converted')::int as converted, count(*) filter (where status = 'spam')::int as spam
    from enquiries where created_at >= ${fromStart} and created_at < ${toEnd}`;

  // ── hours ──
  const days = weekdays(from, to);
  const hours = await sql`select user_id, project_id, minutes, billable, invoice_id from time_entries where date between ${from} and ${to}`;
  const byUser = users.map((u) => {
    const t = hours.filter((h) => String(h.user_id) === String(u.id));
    const sum = (f: (h: (typeof t)[number]) => boolean) => t.filter(f).reduce((a, h) => a + Number(h.minutes), 0);
    const capacity = Math.round((Number(u.weekly_hours) / 5) * days * 60);
    const billable = sum((h) => h.billable);
    return { user_id: String(u.id), name: u.name as string, total_min: sum(() => true), billable_min: billable, billed_min: sum((h) => h.billable && h.invoice_id != null),
      unbilled_min: sum((h) => h.billable && h.invoice_id == null), capacity_min: capacity, utilisation: capacity ? Math.round((billable / capacity) * 100) : 0 };
  }).filter((u) => u.total_min > 0 || !users.find((x) => String(x.id) === u.user_id)?.disabled);
  const byProject: Record<string, { minutes: number; billable: number }> = {};
  for (const h of hours) { const k = String(h.project_id ?? ""); const s = (byProject[k] ??= { minutes: 0, billable: 0 }); s.minutes += Number(h.minutes); if (h.billable) s.billable += Number(h.minutes); }

  // ── VAT ──
  const vatRows = monthsBetween(from, to).map((month) => ({ month, output: 0, input: 0 }));
  const vm = new Map(vatRows.map((v) => [v.month, v]));
  for (const d of invoices) vm.get(String(d.date).slice(0, 7))!.output += conv(Number(d.vat), d.currency, d.fx_rate);
  const expVat = await sql`select date, vat_amount, currency, fx_rate from expenses where date between ${from} and ${to} and vat_amount > 0`;
  for (const e of expVat) vm.get(String(e.date).slice(0, 7))!.input += conv(Number(e.vat_amount), e.currency, e.fx_rate);

  const sortDesc = <T extends { nad: number }>(a: T[]) => a.sort((x, y) => y.nad - x.nad);
  return {
    from, to, usdToNad: usd, generated_at: new Date().toISOString(),
    revenue: {
      invoiced_nad: r2(invoiced), received_nad: r2(received), marketplace_nad: r2(marketplace), expenses_nad: r2(expenses),
      net_cash_nad: r2(received + marketplace - expenses), invoice_count: invoices.length,
      monthly: Object.entries(monthly).map(([month, v]) => ({ month, invoiced: r2(v.invoiced), received: r2(v.received), marketplace: r2(v.marketplace), expenses: r2(v.expenses), net_cash: r2(v.received + v.marketplace - v.expenses) })),
      by_practice: sortDesc(Object.entries(byPractice).map(([practice, nad]) => ({ practice, nad: r2(nad) }))),
      by_partner: sortDesc(Object.entries(byPartner).map(([id, nad]) => ({ user_id: id || null, name: id ? userName.get(id) ?? "Former user" : "Unassigned", nad: r2(nad) }))),
      by_client: Object.entries(byClient).map(([k, v]) => ({ client_id: k.startsWith("snap:") ? null : k, name: v.name, invoiced: r2(v.invoiced), received: r2(v.received), outstanding_now: r2(outstanding[k] ?? 0) }))
        .sort((a, b) => b.invoiced - a.invoiced),
      by_platform: Object.entries(byPlatform).map(([platform, v]) => ({ platform, gross: r2(v.gross), fee: r2(v.fee), net: r2(v.net) })),
      expenses_by_category: sortDesc(Object.entries(byCategory).map(([category, nad]) => ({ category, nad: r2(nad) }))),
    },
    debtors: { total_nad: r2(debtorsTotal), overdue_nad: r2(debtorsOverdue) },
    recurring: { active: rets.length, mrr_nad: r2(mrr), arr_nad: r2(mrr * 12), by_kind: Object.entries(byKind).map(([kind, v]) => ({ kind, count: v.count, nad: r2(v.nad) })) },
    sales: {
      pipeline, open_value_nad: r2(pipeline.reduce((a, p) => a + p.value_nad, 0)), weighted_nad: r2(pipeline.reduce((a, p) => a + p.weighted_nad, 0)),
      win_rate: winRate, won: closed.filter((l) => l.stage === "won").length, lost: closed.filter((l) => l.stage === "lost").length,
      opportunities: opps.map((o) => ({ source: o.source as string, received: o.received, applied: o.applied, won: o.won, avg_fit: o.avg_fit })),
      enquiries: enq,
    },
    hours: {
      weekdays: days, by_user: byUser,
      by_project: Object.entries(byProject).map(([k, v]) => { const p = proj.get(k); return { project_id: k || null, title: p?.title ?? "No project", client: p?.client_id ? clientName.get(String(p.client_id)) ?? "" : "", minutes: v.minutes, billable_min: v.billable, budget_hours: p?.budget_hours == null ? null : Number(p.budget_hours) }; })
        .sort((a, b) => b.minutes - a.minutes),
    },
    vat: { registered: !!cd.vatRegistered, rate: Number(cd.vatRate ?? 0), monthly: vatRows.map((v) => ({ month: v.month, output: r2(v.output), input: r2(v.input), net: r2(v.output - v.input) })) },
  };
}
export type Reports = Awaited<ReturnType<typeof buildReports>>;
