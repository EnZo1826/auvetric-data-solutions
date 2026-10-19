import type { Metadata } from "next";
import Link from "next/link";
import { Fragment } from "react";
import { notFound } from "next/navigation";
import { requireSession } from "@/crm/server/page-auth";
import { clientStatement } from "@/crm/server/finance";
import { HttpError } from "@/crm/server/http";
import { PrintButton } from "@/crm/ui/PrintButton";
import { StatementActions } from "@/crm/ui/StatementActions";
import { formatDate, formatMoney } from "@/crm/shared/calc";
import { PLACEHOLDER, type CompanyData } from "@/crm/shared/types";

export const metadata: Metadata = { title: "Statement" };
export const dynamic = "force-dynamic";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

/** /crm/print/statement?client_id=…&from=YYYY-MM-DD&to=YYYY-MM-DD — A4 statement of account, one section per currency. */
export default async function StatementPage({ searchParams }: { searchParams: Promise<{ client_id?: string; from?: string; to?: string }> }) {
  const session = await requireSession();
  const q = await searchParams;
  if (!/^\d{1,18}$/.test(q.client_id ?? "")) notFound();
  const iso = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
  let st;
  try { st = await clientStatement(q.client_id!, iso(q.from), iso(q.to)); }
  catch (e) { if (e instanceof HttpError && e.status === 404) notFound(); throw e; }
  const c = st.company.data as CompanyData;
  const cl = st.client;
  const coLines = [c.address, [c.phone, c.email].filter(Boolean).join(" · "), c.website].filter(Boolean).join("\n");
  const bank = [c.bankName && `Bank: ${c.bankName}`, c.bankAccountName && `Account name: ${c.bankAccountName}`, c.bankAccount && `Account no.: ${c.bankAccount}`,
    c.bankBranch && `Branch: ${c.bankBranch}${c.bankBranchCode ? ` (${c.bankBranchCode})` : ""}`, c.bankSwift && `SWIFT: ${c.bankSwift}`].filter(Boolean) as string[];

  return (
    <>
      <title>{`Statement ${cl.name} ${st.to}`}</title>
      <div className="print-bar">
        <Link href={`/crm/clients/${cl.id}`} className="btn ghost sm">← Back</Link>
        <form className="row" style={{ gap: 6 }} action="/crm/print/statement">
          <input type="hidden" name="client_id" value={cl.id} />
          <label className="muted" style={{ fontSize: 12 }}>From <input type="date" name="from" defaultValue={st.from} /></label>
          <label className="muted" style={{ fontSize: 12 }}>To <input type="date" name="to" defaultValue={st.to} /></label>
          <button className="sm" type="submit">Update</button>
        </form>
        <div className="grow" />
        <StatementActions clientId={String(cl.id)} from={st.from} to={st.to} canSend={session.user.role !== "readonly"} />
        <PrintButton />
      </div>
      <div className="print-stage">
        <article className="a4" aria-label={`Statement for ${cl.name}`}>
          <header className="pd-head">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <div className="pd-logo"><img src={`${basePath}/brand/auvetric-logo-original.png`} alt={st.company.name} /></div>
            <div className="pd-co"><b>{c.legalName || st.company.name}</b>{"\n"}{coLines}</div>
          </header>
          <div className="pd-rule" />
          <div className="pd-title"><h1>STATEMENT</h1><span className="no">{formatDate(st.from)} – {formatDate(st.to)}</span></div>
          <div className="pd-info">
            <div>
              <h3>Account</h3>
              <div className="who">{cl.name}</div>
              {cl.address && <div className="pre">{cl.address}</div>}
              {cl.email && <div>{cl.email}</div>}
            </div>
            <dl className="pd-meta">
              <dt>Statement date</dt><dd>{formatDate(st.to)}</dd>
              {st.sections.map((s) => <Fragment key={s.currency}><dt>Balance due ({s.currency})</dt><dd style={{ fontWeight: 600 }}>{formatMoney(Math.max(0, s.closing), s.currency)}</dd></Fragment>)}
            </dl>
          </div>

          {st.sections.map((s) => (
            <section key={s.currency} style={{ marginBottom: "6mm" }}>
              {st.sections.length > 1 && <h3 style={{ margin: "0 0 2mm", fontSize: "9pt" }}>{s.currency} account</h3>}
              <table className="pd-table">
                <colgroup><col style={{ width: "13%" }} /><col style={{ width: "21%" }} /><col /><col style={{ width: "14%" }} /><col style={{ width: "13%" }} /><col style={{ width: "14%" }} /></colgroup>
                <thead><tr><th>Date</th><th>Reference</th><th>Details</th><th className="r">Invoiced</th><th className="r">Paid</th><th className="r">Balance</th></tr></thead>
                <tbody>
                  <tr><td>{formatDate(st.from)}</td><td /><td><b>Opening balance</b></td><td /><td /><td className="r">{formatMoney(s.opening, s.currency)}</td></tr>
                  {s.lines.map((l, i) => (
                    <tr key={i}>
                      <td style={{ whiteSpace: "nowrap" }}>{formatDate(l.date)}</td><td style={{ whiteSpace: "nowrap" }}>{l.ref}</td><td>{l.kind === "invoice" ? `Invoice${l.description && l.description !== "Invoice" ? `: ${l.description}` : ""}` : l.description}</td>
                      <td className="r">{l.debit ? formatMoney(l.debit, s.currency) : ""}</td><td className="r">{l.credit ? formatMoney(l.credit, s.currency) : ""}</td>
                      <td className="r">{formatMoney(l.balance, s.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <table className="pd-table" style={{ marginTop: "3mm" }}>
                <thead><tr><th className="r">Not yet due</th><th className="r">1–30 days</th><th className="r">31–60 days</th><th className="r">61–90 days</th><th className="r">90+ days</th><th className="r">Amount due</th></tr></thead>
                <tbody><tr>
                  {(["current", "d30", "d60", "d90", "d90plus"] as const).map((k) => <td key={k} className="r">{formatMoney(s.ageing[k], s.currency)}</td>)}
                  <td className="r"><b>{formatMoney(Math.max(0, s.closing), s.currency)}</b></td>
                </tr></tbody>
              </table>
            </section>
          ))}

          {bank.length > 0 && (
            <section className="pd-sec"><h3>Payment details</h3><div>{bank.map((b) => <div key={b}>{b.includes(PLACEHOLDER) ? <span className="ph">{b}</span> : b}</div>)}<div>Please use the invoice number as your payment reference.</div></div></section>
          )}
        </article>
      </div>
    </>
  );
}
