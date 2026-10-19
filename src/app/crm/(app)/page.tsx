import type { Metadata } from "next";
import Link from "next/link";
import { requireSession } from "@/crm/server/page-auth";
import { db } from "@/crm/server/db";
import { formatDate, formatMoney, todayISO } from "@/crm/shared/calc";
import { entityHref } from "@/crm/shared/sales";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

// NAD equivalent of a document total (USD documents carry their own rate).
const NAD = "case when currency = 'NAD' then total else total * fx_rate end";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default async function Dashboard() {
  const { user } = await requireSession();
  const sql = db();
  const today = todayISO();
  const period = today.slice(0, 7);
  const nad = sql.unsafe(NAD);
  const [[inv], [qt], monthly, [ret], [proj], recent, due, [sec]] = await Promise.all([
    sql`select
          coalesce(sum(${nad}) filter (where status in ('sent','overdue')), 0) as outstanding,
          count(*) filter (where status in ('sent','overdue'))::int as outstanding_n,
          coalesce(sum(${nad}) filter (where status = 'overdue' or (status = 'sent' and due_date < ${today})), 0) as overdue,
          count(*) filter (where status = 'overdue' or (status = 'sent' and due_date < ${today}))::int as overdue_n,
          count(*) filter (where status = 'draft')::int as drafts,
          coalesce(sum(${nad}) filter (where to_char(date, 'YYYY-MM') = ${period} and status not in ('cancelled','draft')), 0) as this_month,
          coalesce(sum(${nad}) filter (where status = 'paid' and to_char(paid_at at time zone 'Africa/Windhoek', 'YYYY') = ${period.slice(0, 4)}), 0) as paid_ytd
        from documents where type = 'invoice'`,
    sql`select count(*) filter (where status in ('draft','sent'))::int as open_n,
               coalesce(sum(${nad}) filter (where status in ('draft','sent')), 0) as open_value,
               count(*) filter (where status in ('accepted','invoiced') and date >= ${today}::date - 365)::int as won,
               count(*) filter (where status in ('accepted','invoiced','declined') and date >= ${today}::date - 365)::int as decided
        from documents where type = 'quote'`,
    sql`select to_char(date, 'YYYY-MM') as period, sum(${nad}) as total from documents
        where type = 'invoice' and status not in ('cancelled','draft') and date >= date_trunc('month', ${today}::date) - interval '11 months'
        group by 1 order by 1`,
    sql`select count(*)::int as total, count(d.id)::int as done from retainers r
        left join documents d on d.retainer_id = r.id and d.period = ${period} where r.active`,
    sql`select count(*) filter (where status <> 'done')::int as active,
               count(*) filter (where status <> 'done' and due_date < ${today})::int as late from projects`,
    sql`select id, type, number, status, date, total, currency, data->'client'->>'name' as client from documents order by updated_at desc limit 8`,
    sql`select p.id, p.title, p.due_date, c.name as client from projects p left join clients c on c.id = p.client_id
        where p.status <> 'done' and p.due_date is not null and p.due_date <= ${today}::date + 14 order by p.due_date limit 8`,
    sql`select (select count(*)::int from users where not disabled and not totp_enabled) as no_mfa,
               (select count(*)::int from login_attempts where not ok and at > now() - interval '24 hours') as failed24`,
  ]);

  // Sales (Phase 2). Pipeline in NAD: USD leads at the company rate; probability falls back to the stage default.
  const [co] = await sql`select (data->>'usdToNad')::numeric as usd from companies where is_default`;
  const usd = Number(co?.usd ?? 18.5);
  const [[sales], topJobs, myTasks] = await Promise.all([
    sql`select
          (select count(*)::int from enquiries where status = 'new') as new_enquiries,
          (select count(*)::int from enquiries where triage_status in ('pending','claimed') and status <> 'spam') as awaiting_triage,
          (select count(*)::int from leads where stage in ('new','qualified','discovery','proposal','negotiation')) as open_leads,
          (select coalesce(sum(coalesce(value, 0) * case when currency = 'USD' then ${usd}::numeric else 1 end), 0) from leads
             where stage in ('new','qualified','discovery','proposal','negotiation')) as pipeline,
          (select coalesce(sum(coalesce(value, 0) * case when currency = 'USD' then ${usd}::numeric else 1 end
             * coalesce(probability, case stage when 'new' then 10 when 'qualified' then 25 when 'discovery' then 40 when 'proposal' then 60 else 80 end) / 100.0), 0)
             from leads where stage in ('new','qualified','discovery','proposal','negotiation')) as weighted,
          (select count(*)::int from leads where stage not in ('won','lost') and next_follow_up <= ${today}) as follow_ups_due,
          (select count(*)::int from opportunities where status = 'new' and fit_score >= 70 and received_at > now() - interval '7 days') as strong_jobs`,
    sql`select id, title, source, fit_score, budget from opportunities where status in ('new','shortlisted') and received_at > now() - interval '7 days'
        order by fit_score desc, received_at desc limit 6`,
    sql`select t.id, t.title, t.due_date, t.entity, t.entity_id from tasks t where not t.done and t.assignee_user_id = ${user.id}
          and (t.due_date is null or t.due_date <= ${today}::date + 7) order by t.due_date nulls last limit 8`,
  ]);

  const months: { key: string; label: string; total: number }[] = [];
  const [y, m] = period.split("-").map(Number);
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    const key = d.toISOString().slice(0, 7);
    months.push({ key, label: MONTHS[d.getUTCMonth()], total: Number(monthly.find((r) => r.period === key)?.total ?? 0) });
  }
  const max = Math.max(1, ...months.map((x) => x.total));
  const winRate = qt.decided ? Math.round((qt.won / qt.decided) * 100) : null;
  const N = (v: number) => formatMoney(Number(v), "NAD");

  return (
    <>
      <div className="page-head">
        <h1>Good to see you, {user.name.split(" ")[0]}</h1>
        <Link className="btn" href="/crm/quotes/new">New quote</Link>
        <Link className="btn primary" href="/crm/invoices/new">New invoice</Link>
      </div>

      {(sec.no_mfa > 0 || sec.failed24 > 0) && (
        <div className="warn-box" style={{ marginBottom: 12 }}>
          {sec.no_mfa > 0 && <>{sec.no_mfa} user(s) haven&apos;t finished two-factor set-up. </>}
          {sec.failed24 > 0 && <>{sec.failed24} failed sign-in attempt(s) in the last 24 hours.</>}
        </div>
      )}

      <div className="grid4" style={{ marginBottom: 12 }}>
        <Link href="/crm/enquiries" className="card kpi" style={{ textDecoration: "none", color: "inherit", ...(sales.new_enquiries ? { borderColor: "color-mix(in srgb, var(--brand) 55%, transparent)" } : {}) }}>
          <span className="l">New enquiries</span><span className="v">{sales.new_enquiries}</span>
          <span className="s">{sales.awaiting_triage ? `${sales.awaiting_triage} awaiting AI triage` : "all triaged"}</span>
        </Link>
        <Link href="/crm/leads" className="card kpi" style={{ textDecoration: "none", color: "inherit" }}>
          <span className="l">Open pipeline</span><span className="v">{N(sales.pipeline)}</span>
          <span className="s">{sales.open_leads} lead(s) · weighted {N(sales.weighted)}</span>
        </Link>
        <Link href="/crm/opportunities" className="card kpi" style={{ textDecoration: "none", color: "inherit" }}>
          <span className="l">Strong job matches</span><span className="v">{sales.strong_jobs}</span><span className="s">new, fit ≥ 70, last 7 days</span>
        </Link>
        <Link href="/crm/tasks" className="card kpi" style={{ textDecoration: "none", color: "inherit", ...(sales.follow_ups_due ? { borderColor: "color-mix(in srgb, var(--warn) 45%, transparent)" } : {}) }}>
          <span className="l">My tasks · 7 days</span><span className="v">{myTasks.length}</span>
          <span className="s">{sales.follow_ups_due ? `${sales.follow_ups_due} lead follow-up(s) due` : "no follow-ups due"}</span>
        </Link>
        <Link href="/crm/invoices" className="card kpi" style={{ textDecoration: "none", color: "inherit" }}>
          <span className="l">Outstanding</span><span className="v">{N(inv.outstanding)}</span><span className="s">{inv.outstanding_n} invoice(s) awaiting payment</span>
        </Link>
        <div className="card kpi" style={inv.overdue_n ? { borderColor: "color-mix(in srgb, var(--err) 45%, transparent)" } : undefined}>
          <span className="l">Overdue</span><span className="v" style={inv.overdue_n ? { color: "var(--err)" } : undefined}>{N(inv.overdue)}</span><span className="s">{inv.overdue_n ? `${inv.overdue_n} past due date` : "nothing overdue"}</span>
        </div>
        <div className="card kpi"><span className="l">Invoiced · {MONTHS[m - 1]}</span><span className="v">{N(inv.this_month)}</span><span className="s">{inv.drafts} draft(s) not yet sent</span></div>
        <div className="card kpi"><span className="l">Paid · {y}</span><span className="v">{N(inv.paid_ytd)}</span><span className="s">NAD equivalent</span></div>
        <Link href="/crm/quotes" className="card kpi" style={{ textDecoration: "none", color: "inherit" }}>
          <span className="l">Open quotes</span><span className="v">{N(qt.open_value)}</span><span className="s">{qt.open_n} open{winRate != null ? ` · ${winRate}% won (12 mo)` : ""}</span>
        </Link>
        <Link href="/crm/projects" className="card kpi" style={{ textDecoration: "none", color: "inherit" }}>
          <span className="l">Active projects</span><span className="v">{proj.active}</span><span className="s">{proj.late ? `${proj.late} past due` : "none late"}</span>
        </Link>
        <Link href="/crm/retainers" className="card kpi" style={{ textDecoration: "none", color: "inherit" }}>
          <span className="l">Retainers · {MONTHS[m - 1]}</span><span className="v">{ret.done} / {ret.total}</span><span className="s">{ret.total - ret.done > 0 ? `${ret.total - ret.done} still to invoice` : ret.total ? "all invoiced" : "none set up"}</span>
        </Link>
        <div className="card kpi"><span className="l">Two-factor</span><span className="v" style={{ fontSize: 16 }}>{user.totpEnabled ? <span className="badge ok">enabled</span> : <span className="badge err">not set</span>}</span><span className="s"><Link href="/crm/account">My account</Link></span></div>
      </div>

      <div className="grid2" style={{ marginBottom: 12 }}>
        <section className="card">
          <h2>Top job matches <span className="dim" style={{ fontSize: 12, fontWeight: 400 }}>last 7 days</span></h2>
          {!topJobs.length ? <div className="dim" style={{ fontSize: 13 }}>No new listings this week.</div> : (
            <table className="tbl"><tbody>{topJobs.map((o) => (
              <tr key={o.id}>
                <td className="r tabular" style={{ width: 36, fontWeight: 700, color: o.fit_score >= 75 ? "var(--ok)" : o.fit_score >= 50 ? "var(--warn)" : "var(--dim)" }}>{o.fit_score}</td>
                <td><Link href={`/crm/opportunities?open=${o.id}`}>{o.title}</Link><div className="dim" style={{ fontSize: 12, textTransform: "capitalize" }}>{o.source}{o.budget ? ` · ${o.budget}` : ""}</div></td>
              </tr>
            ))}</tbody></table>
          )}
        </section>
        <section className="card">
          <h2>My tasks</h2>
          {!myTasks.length ? <div className="dim" style={{ fontSize: 13 }}>Nothing due in the next 7 days.</div> : (
            <table className="tbl"><tbody>{myTasks.map((t) => {
              const href = entityHref(t.entity, t.entity_id) ?? "/crm/tasks";
              return (
                <tr key={t.id}><td><Link href={href}>{t.title}</Link></td>
                  <td className="r nowrap" style={t.due_date && t.due_date < today ? { color: "var(--err)" } : undefined}>{t.due_date ? formatDate(t.due_date) : "—"}</td></tr>
              );
            })}</tbody></table>
          )}
        </section>
      </div>

      <div className="grid2" style={{ marginBottom: 12 }}>
        <section className="card">
          <h2>Invoiced per month <span className="dim" style={{ fontSize: 12, fontWeight: 400 }}>NAD equivalent, excl. drafts and cancelled</span></h2>
          <div className="bars" role="img" aria-label="Invoiced per month for the last 12 months">
            {months.map((x) => (
              <div className="b" key={x.key} title={`${x.key}: ${N(x.total)}`}>
                <i style={{ height: `${(x.total / max) * 100}%` }} />
                <span>{x.label}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="card">
          <h2>Due in the next 14 days</h2>
          {!due.length ? <div className="dim" style={{ fontSize: 13 }}>No project deadlines coming up.</div> : (
            <table className="tbl"><tbody>{due.map((p) => (
              <tr key={p.id}><td><Link href={`/crm/projects?open=${p.id}`}>{p.title}</Link><div className="dim" style={{ fontSize: 12 }}>{p.client ?? ""}</div></td>
                <td className="r nowrap" style={p.due_date < today ? { color: "var(--err)" } : undefined}>{formatDate(p.due_date)}</td></tr>
            ))}</tbody></table>
          )}
        </section>
      </div>

      <section className="card flush">
        <div style={{ padding: "14px 16px 4px" }}><h2>Recently updated</h2></div>
        {!recent.length ? <div className="empty">No quotes or invoices yet. <Link href="/crm/clients">Add a client</Link>, then create a quote.</div> : (
          <div className="tbl-wrap"><table className="tbl"><tbody>{recent.map((d) => (
            <tr key={d.id}>
              <td className="mono"><Link href={`/crm/${d.type}s/${d.id}`}>{d.number}</Link></td>
              <td style={{ textTransform: "capitalize" }} className="muted">{d.type}</td>
              <td>{d.client}</td><td className="muted">{formatDate(d.date)}</td>
              <td><span className="badge" style={{ textTransform: "capitalize" }}>{d.status}</span></td>
              <td className="r tabular">{formatMoney(Number(d.total), d.currency)}</td>
            </tr>
          ))}</tbody></table></div>
        )}
      </section>
    </>
  );
}
