"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import { crmFetch } from "./api";
import { errText, useCrm } from "./store";
import { Empty, Field, PageHead, Tabs } from "./ui";
import { fmtHours } from "./Time";
import { addDays, formatMoney, todayISO } from "@/crm/shared/calc";
import { stageLabel } from "@/crm/shared/sales";
import { practiceLabel, PRACTICES, RETAINER_LABEL, type RetainerKind } from "@/crm/shared/types";
import type { Reports } from "@/crm/server/reports";

const N = (v: number) => formatMoney(v, "NAD");
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const MONTH = (k: string) => new Date(k + "-01T00:00:00Z").toLocaleDateString("en-NA", { month: "short", year: "2-digit", timeZone: "UTC" });

function presets(): Record<string, { label: string; from: string; to: string }> {
  const t = todayISO(), y = Number(t.slice(0, 4));
  const firstThis = t.slice(0, 8) + "01", lastPrevEnd = addDays(firstThis, -1);
  return {
    ytd: { label: "This year", from: `${y}-01-01`, to: t },
    last_year: { label: "Last year", from: `${y - 1}-01-01`, to: `${y - 1}-12-31` },
    l12: { label: "Last 12 months", from: new Date(Date.UTC(y, Number(t.slice(5, 7)) - 12, 1)).toISOString().slice(0, 10), to: t },
    this_month: { label: "This month", from: firstThis, to: t },
    last_month: { label: "Last month", from: lastPrevEnd.slice(0, 8) + "01", to: lastPrevEnd },
  };
}

function csv(name: string, header: string[], rows: (string | number | null)[][]) {
  const esc = (v: string | number | null) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const blob = new Blob(["\ufeff" + [header, ...rows].map((r) => r.map(esc).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
const CsvButton = ({ onClick }: { onClick: () => void }) => <button className="ghost sm" onClick={onClick} aria-label="Download as CSV"><Download /> CSV</button>;

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return <div className="card kpi"><span className="l">{label}</span><span className="v">{value}</span>{sub && <span className="s">{sub}</span>}</div>;
}
/** Horizontal share bars; the list sums to `total`. */
function Bars({ items, total, money = true }: { items: { label: string; value: number; color?: string; href?: string }[]; total: number; money?: boolean }) {
  if (!items.length) return <div className="dim" style={{ fontSize: 13 }}>Nothing in this period.</div>;
  const max = Math.max(...items.map((i) => Math.abs(i.value)), 1);
  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
      {items.map((i) => (
        <li key={i.label} style={{ display: "grid", gridTemplateColumns: "minmax(110px, 30%) 1fr auto", gap: 10, alignItems: "center", fontSize: 13 }}>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={i.label}>{i.href ? <Link href={i.href}>{i.label}</Link> : i.label}</span>
          <span aria-hidden style={{ height: 10, borderRadius: 5, background: "var(--line)", overflow: "hidden" }}>
            <span style={{ display: "block", height: "100%", width: `${(Math.abs(i.value) / max) * 100}%`, background: i.color ?? "var(--brand)" }} />
          </span>
          <span className="tabular" style={{ minWidth: 120, textAlign: "right" }}>{money ? N(i.value) : i.value}{total > 0 && <span className="dim" style={{ fontSize: 11 }}> · {Math.round((i.value / total) * 100)}%</span>}</span>
        </li>
      ))}
    </ul>
  );
}
function MonthChart({ rows }: { rows: Reports["revenue"]["monthly"] }) {
  const max = Math.max(1, ...rows.flatMap((r) => [r.invoiced, r.received + r.marketplace, r.expenses]));
  return (
    <figure style={{ margin: 0 }}>
      <div role="img" aria-label="Monthly invoiced, received and expenses" style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 160, padding: "0 2px", borderBottom: "1px solid var(--line)", overflowX: "auto" }}>
        {rows.map((r) => (
          <div key={r.month} title={`${MONTH(r.month)}: invoiced ${N(r.invoiced)}, received ${N(r.received + r.marketplace)}, expenses ${N(r.expenses)}`} style={{ flex: "1 0 22px", display: "flex", alignItems: "flex-end", gap: 2, height: "100%" }}>
            <span style={{ flex: 1, height: `${(r.invoiced / max) * 100}%`, background: "var(--brand)", borderRadius: "3px 3px 0 0", minHeight: r.invoiced ? 2 : 0 }} />
            <span style={{ flex: 1, height: `${((r.received + r.marketplace) / max) * 100}%`, background: "var(--ok)", borderRadius: "3px 3px 0 0", minHeight: r.received + r.marketplace ? 2 : 0 }} />
            <span style={{ flex: 1, height: `${(r.expenses / max) * 100}%`, background: "var(--warn)", borderRadius: "3px 3px 0 0", minHeight: r.expenses ? 2 : 0 }} />
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6, padding: "4px 2px 0", overflowX: "auto" }}>{rows.map((r) => <span key={r.month} className="dim" style={{ flex: "1 0 22px", fontSize: 10, textAlign: "center" }}>{MONTH(r.month)}</span>)}</div>
      <figcaption className="dim" style={{ fontSize: 12, marginTop: 6, display: "flex", gap: 14 }}>
        <span><i style={{ display: "inline-block", width: 10, height: 10, background: "var(--brand)", borderRadius: 2 }} /> Invoiced (excl. VAT)</span>
        <span><i style={{ display: "inline-block", width: 10, height: 10, background: "var(--ok)", borderRadius: 2 }} /> Received + platform income</span>
        <span><i style={{ display: "inline-block", width: 10, height: 10, background: "var(--warn)", borderRadius: 2 }} /> Expenses</span>
      </figcaption>
    </figure>
  );
}

type Tab = "revenue" | "sales" | "hours" | "recurring" | "vat";

export function ReportsScreen() {
  const { toast } = useCrm();
  const P = useMemo(presets, []);
  const [preset, setPreset] = useState("ytd");
  const [from, setFrom] = useState(P.ytd.from);
  const [to, setTo] = useState(P.ytd.to);
  const [tab, setTab] = useState<Tab>("revenue");
  const [r, setR] = useState<Reports | null>(null);
  const [loading, setLoading] = useState(false);
  const load = useCallback(() => {
    setLoading(true);
    crmFetch<Reports>(`/api/crm/reports?from=${from}&to=${to}`).then(setR).catch((e) => toast(errText(e), "err")).finally(() => setLoading(false));
  }, [from, to, toast]);
  useEffect(() => { load(); }, [load]);
  const pick = (k: string) => { setPreset(k); if (P[k]) { setFrom(P[k].from); setTo(P[k].to); } };
  const tag = `${from}_${to}`;

  return (
    <>
      <PageHead title="Reports"><button className="ghost" onClick={load} disabled={loading} aria-label="Refresh"><RefreshCw /> {loading ? "Loading…" : "Refresh"}</button></PageHead>
      <div className="filters" style={{ alignItems: "end" }}>
        <Field label="Period">
          <select value={preset} onChange={(e) => pick(e.target.value)}>{Object.entries(P).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}<option value="custom">Custom</option></select>
        </Field>
        <Field label="From"><input type="date" value={from} max={to} onChange={(e) => { setPreset("custom"); setFrom(e.target.value); }} /></Field>
        <Field label="To"><input type="date" value={to} min={from} onChange={(e) => { setPreset("custom"); setTo(e.target.value); }} /></Field>
        <span className="dim" style={{ fontSize: 12, marginLeft: "auto", maxWidth: 380 }}>All amounts in NAD. USD records use their own exchange rate{r ? `; open leads and retainers use N$ ${r.usdToNad} per US$` : ""}.</span>
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[{ key: "revenue", label: "Revenue" }, { key: "sales", label: "Sales" }, { key: "hours", label: "Hours" }, { key: "recurring", label: "Recurring & debtors" }, { key: "vat", label: "VAT" }]} />
      {!r ? <Empty>Loading…</Empty> : (
        <div className="stack" style={{ marginTop: 12 }} aria-busy={loading}>
          {tab === "revenue" && <>
            <div className="grid4">
              <Kpi label="Invoiced (excl. VAT)" value={N(r.revenue.invoiced_nad)} sub={`${r.revenue.invoice_count} invoice${r.revenue.invoice_count === 1 ? "" : "s"}`} />
              <Kpi label="Received" value={N(r.revenue.received_nad)} sub={r.revenue.marketplace_nad ? `+ ${N(r.revenue.marketplace_nad)} platform income` : "payments against invoices"} />
              <Kpi label="Expenses" value={N(r.revenue.expenses_nad)} sub="incl. VAT paid" />
              <Kpi label="Net cash" value={N(r.revenue.net_cash_nad)} sub="received + platform − expenses" />
            </div>
            <section className="card stack">
              <div className="row" style={{ justifyContent: "space-between" }}><h2 style={{ margin: 0 }}>By month</h2>
                <CsvButton onClick={() => csv(`auvetric-revenue-monthly-${tag}.csv`, ["Month", "Invoiced excl VAT", "Received", "Platform income", "Expenses", "Net cash"], r.revenue.monthly.map((m) => [m.month, m.invoiced, m.received, m.marketplace, m.expenses, m.net_cash]))} /></div>
              <MonthChart rows={r.revenue.monthly} />
            </section>
            <div className="grid2">
              <section className="card stack">
                <h2 style={{ margin: 0 }}>By practice</h2>
                <Bars total={r.revenue.invoiced_nad} items={r.revenue.by_practice.map((p) => ({ label: p.practice === "unassigned" ? "Unassigned" : practiceLabel(p.practice), value: p.nad, color: PRACTICES.find((x) => x.key === p.practice)?.color }))} />
                <p className="dim" style={{ margin: 0, fontSize: 12 }}>From each line&apos;s service, else the invoice&apos;s project. Unassigned lines have neither.</p>
              </section>
              <section className="card stack">
                <h2 style={{ margin: 0 }}>By partner</h2>
                <Bars total={r.revenue.invoiced_nad} items={r.revenue.by_partner.map((p) => ({ label: p.name, value: p.nad }))} />
                <p className="dim" style={{ margin: 0, fontSize: 12 }}>The project lead, else whoever created the invoice.</p>
              </section>
            </div>
            <section className="card flush">
              <div className="row" style={{ justifyContent: "space-between", padding: "12px 14px 0" }}><h2 style={{ margin: 0 }}>By client</h2>
                <CsvButton onClick={() => csv(`auvetric-revenue-clients-${tag}.csv`, ["Client", "Invoiced excl VAT", "Received", "Open balance now"], r.revenue.by_client.map((c) => [c.name, c.invoiced, c.received, c.outstanding_now]))} /></div>
              {!r.revenue.by_client.length ? <Empty>No invoices or payments in this period.</Empty> : (
                <div className="tbl-wrap"><table className="tbl">
                  <thead><tr><th>Client</th><th className="r">Invoiced (excl. VAT)</th><th className="r">Received</th><th className="r">Open balance now</th></tr></thead>
                  <tbody>{r.revenue.by_client.map((c) => (
                    <tr key={c.client_id ?? c.name}><td>{c.client_id ? <Link href={`/crm/clients/${c.client_id}`}>{c.name}</Link> : c.name}</td>
                      <td className="r tabular">{N(c.invoiced)}</td><td className="r tabular">{N(c.received)}</td><td className="r tabular">{c.outstanding_now ? N(c.outstanding_now) : <span className="dim">—</span>}</td></tr>
                  ))}</tbody>
                  <tfoot><tr><th>Total</th><th className="r tabular">{N(r.revenue.invoiced_nad)}</th><th className="r tabular">{N(r.revenue.received_nad)}</th><td /></tr></tfoot>
                </table></div>
              )}
            </section>
            <div className="grid2">
              <section className="card stack">
                <h2 style={{ margin: 0 }}>Platform income</h2>
                {!r.revenue.by_platform.length ? <div className="dim" style={{ fontSize: 13 }}>None recorded. Add Upwork/Fiverr payouts under <Link href="/crm/marketplace">Marketplace</Link>.</div> : (
                  <table className="tbl"><thead><tr><th>Platform</th><th className="r">Gross</th><th className="r">Fees</th><th className="r">Net</th></tr></thead>
                    <tbody>{r.revenue.by_platform.map((p) => <tr key={p.platform}><td>{cap(p.platform)}</td><td className="r tabular">{N(p.gross)}</td><td className="r tabular">{N(p.fee)}</td><td className="r tabular">{N(p.net)}</td></tr>)}</tbody></table>
                )}
              </section>
              <section className="card stack">
                <h2 style={{ margin: 0 }}>Expenses by category</h2>
                <Bars total={r.revenue.expenses_nad} items={r.revenue.expenses_by_category.map((e) => ({ label: cap(e.category), value: e.nad, color: "var(--warn)" }))} />
              </section>
            </div>
          </>}

          {tab === "sales" && <>
            <div className="grid4">
              <Kpi label="Open pipeline" value={N(r.sales.open_value_nad)} sub={`${r.sales.pipeline.reduce((a, p) => a + p.count, 0)} open leads`} />
              <Kpi label="Weighted pipeline" value={N(r.sales.weighted_nad)} sub="value × probability" />
              <Kpi label="Won / lost in period" value={`${r.sales.won} / ${r.sales.lost}`} sub={r.sales.won + r.sales.lost ? `${Math.round((r.sales.won / (r.sales.won + r.sales.lost)) * 100)}% win rate` : "no leads closed"} />
              <Kpi label="Website enquiries" value={String(r.sales.enquiries.received)} sub={`${r.sales.enquiries.converted} converted · ${r.sales.enquiries.spam} spam`} />
            </div>
            <section className="card stack">
              <h2 style={{ margin: 0 }}>Pipeline by stage <span className="dim" style={{ fontSize: 12, fontWeight: 400 }}>(now)</span></h2>
              <div className="tbl-wrap"><table className="tbl">
                <thead><tr><th>Stage</th><th className="r">Leads</th><th className="r">Value</th><th className="r">Weighted</th></tr></thead>
                <tbody>{r.sales.pipeline.map((p) => <tr key={p.stage}><td>{stageLabel(p.stage)}</td><td className="r tabular">{p.count}</td><td className="r tabular">{N(p.value_nad)}</td><td className="r tabular">{N(p.weighted_nad)}</td></tr>)}</tbody>
              </table></div>
            </section>
            <div className="grid2">
              <section className="card stack">
                <div className="row" style={{ justifyContent: "space-between" }}><h2 style={{ margin: 0 }}>Win rate by source</h2>
                  <CsvButton onClick={() => csv(`auvetric-win-rate-${tag}.csv`, ["Source", "Won", "Lost", "Win rate %", "Won value NAD"], r.sales.win_rate.map((w) => [w.source, w.won, w.lost, w.rate, w.won_value_nad]))} /></div>
                {!r.sales.win_rate.length ? <div className="dim" style={{ fontSize: 13 }}>No leads were won or lost in this period.</div> : (
                  <table className="tbl"><thead><tr><th>Source</th><th className="r">Won</th><th className="r">Lost</th><th className="r">Win rate</th><th className="r">Won value</th></tr></thead>
                    <tbody>{r.sales.win_rate.map((w) => <tr key={w.source}><td>{cap(w.source)}</td><td className="r tabular">{w.won}</td><td className="r tabular">{w.lost}</td><td className="r tabular">{w.rate}%</td><td className="r tabular">{N(w.won_value_nad)}</td></tr>)}</tbody></table>
                )}
              </section>
              <section className="card stack">
                <h2 style={{ margin: 0 }}>Opportunities by source</h2>
                {!r.sales.opportunities.length ? <div className="dim" style={{ fontSize: 13 }}>No listings received in this period.</div> : (
                  <table className="tbl"><thead><tr><th>Source</th><th className="r">Received</th><th className="r">Applied</th><th className="r">Won</th><th className="r">Avg fit</th></tr></thead>
                    <tbody>{r.sales.opportunities.map((o) => <tr key={o.source}><td>{cap(o.source)}</td><td className="r tabular">{o.received}</td><td className="r tabular">{o.applied}</td><td className="r tabular">{o.won}</td><td className="r tabular">{o.avg_fit ?? "—"}</td></tr>)}</tbody></table>
                )}
              </section>
            </div>
          </>}

          {tab === "hours" && <>
            <section className="card flush">
              <div className="row" style={{ justifyContent: "space-between", padding: "12px 14px 0" }}><h2 style={{ margin: 0 }}>Utilisation by partner</h2>
                <CsvButton onClick={() => csv(`auvetric-hours-partners-${tag}.csv`, ["Partner", "Total h", "Billable h", "Invoiced h", "Unbilled h", "Capacity h", "Utilisation %"], r.hours.by_user.map((u) => [u.name, u.total_min / 60, u.billable_min / 60, u.billed_min / 60, u.unbilled_min / 60, u.capacity_min / 60, u.utilisation]))} /></div>
              <div className="tbl-wrap"><table className="tbl">
                <thead><tr><th>Partner</th><th className="r">Logged</th><th className="r">Billable</th><th className="r">Invoiced</th><th className="r">Not yet invoiced</th><th className="r">Capacity</th><th style={{ width: "22%" }}>Utilisation (billable ÷ capacity)</th></tr></thead>
                <tbody>{r.hours.by_user.map((u) => (
                  <tr key={u.user_id}><td>{u.name}</td><td className="r tabular">{fmtHours(u.total_min)}</td><td className="r tabular">{fmtHours(u.billable_min)}</td><td className="r tabular">{fmtHours(u.billed_min)}</td>
                    <td className="r tabular">{u.unbilled_min ? <Link href="/crm/time">{fmtHours(u.unbilled_min)}</Link> : "0:00"}</td><td className="r tabular">{fmtHours(u.capacity_min)}</td>
                    <td><div className="row" style={{ gap: 8, flexWrap: "nowrap" }}><span aria-hidden style={{ flex: 1, height: 8, borderRadius: 4, background: "var(--line)", overflow: "hidden" }}><span style={{ display: "block", height: "100%", width: `${Math.min(100, u.utilisation)}%`, background: u.utilisation >= 60 ? "var(--ok)" : "var(--brand)" }} /></span><span className="tabular" style={{ minWidth: 38, textAlign: "right" }}>{u.utilisation}%</span></div></td></tr>
                ))}</tbody>
              </table></div>
              <p className="dim" style={{ margin: "0 14px 12px", fontSize: 12 }}>Capacity = {r.hours.weekdays} weekdays × each partner&apos;s hours per week ÷ 5 (set under Users).</p>
            </section>
            <section className="card flush">
              <div className="row" style={{ justifyContent: "space-between", padding: "12px 14px 0" }}><h2 style={{ margin: 0 }}>By project</h2>
                <CsvButton onClick={() => csv(`auvetric-hours-projects-${tag}.csv`, ["Project", "Client", "Hours", "Billable h", "Budget h"], r.hours.by_project.map((p) => [p.title, p.client, p.minutes / 60, p.billable_min / 60, p.budget_hours]))} /></div>
              {!r.hours.by_project.length ? <Empty>No time logged in this period.</Empty> : (
                <div className="tbl-wrap"><table className="tbl">
                  <thead><tr><th>Project</th><th>Client</th><th className="r">Logged</th><th className="r">Billable</th><th className="r">Budget</th></tr></thead>
                  <tbody>{r.hours.by_project.map((p) => (
                    <tr key={p.project_id ?? "none"}><td>{p.title}</td><td className="muted">{p.client || "—"}</td><td className="r tabular">{fmtHours(p.minutes)}</td><td className="r tabular">{fmtHours(p.billable_min)}</td>
                      <td className="r tabular">{p.budget_hours ? <span style={{ color: p.minutes / 60 > p.budget_hours ? "var(--err)" : undefined }}>{Math.round((p.minutes / 60 / p.budget_hours) * 100)}% of {p.budget_hours} h</span> : <span className="dim">—</span>}</td></tr>
                  ))}</tbody>
                </table></div>
              )}
            </section>
          </>}

          {tab === "recurring" && <>
            <div className="grid4">
              <Kpi label="Monthly recurring" value={N(r.recurring.mrr_nad)} sub={`${r.recurring.active} active retainer${r.recurring.active === 1 ? "" : "s"}`} />
              <Kpi label="Annualised" value={N(r.recurring.arr_nad)} sub="monthly × 12" />
              <Kpi label="Owed to us now" value={N(r.debtors.total_nad)} sub="open invoice balances" />
              <Kpi label="Overdue now" value={N(r.debtors.overdue_nad)} sub="past the due date" />
            </div>
            <div className="grid2">
              <section className="card stack">
                <h2 style={{ margin: 0 }}>Recurring income by type</h2>
                <Bars total={r.recurring.mrr_nad} items={r.recurring.by_kind.map((k) => ({ label: `${RETAINER_LABEL[k.kind as RetainerKind] ?? k.kind} (${k.count})`, value: k.nad }))} />
                <Link href="/crm/retainers" style={{ fontSize: 13 }}>Manage retainers →</Link>
              </section>
              <section className="card stack">
                <h2 style={{ margin: 0 }}>Debtors</h2>
                <p className="muted" style={{ margin: 0, fontSize: 13 }}>Per-client ageing (not yet due, 30, 60, 90, 90+ days) and statements are on the Payments page.</p>
                <Link href="/crm/payments" style={{ fontSize: 13 }}>Open debtors ageing →</Link>
              </section>
            </div>
          </>}

          {tab === "vat" && <section className="card stack">
            <div className="row" style={{ justifyContent: "space-between" }}><h2 style={{ margin: 0 }}>VAT summary</h2>
              <CsvButton onClick={() => csv(`auvetric-vat-${tag}.csv`, ["Month", "Output VAT", "Input VAT", "Net payable"], r.vat.monthly.map((v) => [v.month, v.output, v.input, v.net]))} /></div>
            {!r.vat.registered && <div className="warn-box">Auvetric isn&apos;t VAT-registered (Company profile), so invoices charge no VAT. The input VAT column shows VAT you paid on expenses, for reference.</div>}
            <div className="tbl-wrap"><table className="tbl">
              <thead><tr><th>Month</th><th className="r">Output VAT (invoices)</th><th className="r">Input VAT (expenses)</th><th className="r">Net</th></tr></thead>
              <tbody>{r.vat.monthly.map((v) => <tr key={v.month}><td>{MONTH(v.month)}</td><td className="r tabular">{N(v.output)}</td><td className="r tabular">{N(v.input)}</td><td className="r tabular">{N(v.net)}</td></tr>)}</tbody>
              <tfoot><tr><th>Total</th><th className="r tabular">{N(r.vat.monthly.reduce((a, v) => a + v.output, 0))}</th><th className="r tabular">{N(r.vat.monthly.reduce((a, v) => a + v.input, 0))}</th><th className="r tabular">{N(r.vat.monthly.reduce((a, v) => a + v.net, 0))}</th></tr></tfoot>
            </table></div>
            <p className="dim" style={{ margin: 0, fontSize: 12 }}>A working figure for your accountant, by invoice and expense date; it is not a NamRA return.</p>
          </section>}
        </div>
      )}
    </>
  );
}
