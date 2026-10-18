/* A4 quote / invoice in the Auvetric document style: white page, navy text, blue accent rule.
   Pure component (no hooks) so it renders on the server for the print route and in the editor preview. */
import { computeTotals, formatDate, formatMoney, formatQty, lineAmount } from "@/crm/shared/calc";
import { PLACEHOLDER, PROPOSAL_FIELDS, type CompanyData, type Currency, type DocData, type DocType } from "@/crm/shared/types";

export interface PrintableDoc { type: DocType; number: string; date: string; due_date: string; currency: Currency; fx_rate?: number | null; data: DocData; status?: string }

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

/** Placeholder values are highlighted on screen (and print plainly) so nobody sends a document with them unnoticed. */
function V({ v }: { v: string }) {
  return v.includes(PLACEHOLDER) ? <span className="ph">{v}</span> : <>{v}</>;
}

export function DocumentPrint({ doc, company }: { doc: PrintableDoc; company: { name: string; data: CompanyData } }) {
  const c = company.data;
  const d = doc.data;
  const cur = doc.currency;
  const t = computeTotals(d.lines, d.vatRate, d.discount);
  const isQuote = doc.type === "quote";
  const title = isQuote ? "QUOTATION" : c.vatRegistered ? "TAX INVOICE" : "INVOICE";
  const p = d.proposal;
  const sections = isQuote && p ? PROPOSAL_FIELDS.filter((f) => p[f.key]?.trim()) : [];
  const coLines = [c.address, [c.phone, c.email].filter(Boolean).join(" · "), c.website].filter(Boolean).join("\n");
  const regLines = [c.regNo && `Reg. no. ${c.regNo}`, c.vatRegistered && c.vatNo && `VAT no. ${c.vatNo}`].filter(Boolean) as string[];

  return (
    <article className="a4" aria-label={`${title} ${doc.number}`}>
      <header className="pd-head">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <div className="pd-logo"><img src={`${basePath}/brand/auvetric-logo-original.png`} alt={company.name} /></div>
        <div className="pd-co">
          <b>{c.legalName || company.name}</b>{"\n"}{coLines}
          {regLines.map((r) => <div key={r}><V v={r} /></div>)}
        </div>
      </header>
      <div className="pd-rule" />

      <div className="pd-title">
        <h1>{title}</h1>
        <span className="no">{doc.number}</span>
      </div>

      <div className="pd-info">
        <div>
          <h3>{isQuote ? "Prepared for" : "Bill to"}</h3>
          <div className="who">{d.client.name}</div>
          {d.client.contact && <div>Attn: {d.client.contact}</div>}
          {d.client.address && <div className="pre">{d.client.address}</div>}
          {[d.client.email, d.client.phone].filter(Boolean).length > 0 && <div>{[d.client.email, d.client.phone].filter(Boolean).join(" · ")}</div>}
          {d.client.vat_no && <div>VAT no. {d.client.vat_no}</div>}
        </div>
        <dl className="pd-meta">
          <dt>Date</dt><dd>{formatDate(doc.date)}</dd>
          <dt>{isQuote ? "Valid until" : "Due date"}</dt><dd>{formatDate(doc.due_date)}</dd>
          <dt>Currency</dt><dd>{cur}</dd>
          {d.remarks && <><dt>Reference</dt><dd className="pre" style={{ fontWeight: 500 }}>{d.remarks}</dd></>}
        </dl>
      </div>

      {sections.map((f) => (
        <section className="pd-sec" key={f.key}><h3>{f.label}</h3><div>{p![f.key]}</div></section>
      ))}

      <table className="pd-table">
        <colgroup><col style={{ width: "6%" }} /><col /><col style={{ width: "11%" }} /><col style={{ width: "17%" }} /><col style={{ width: "18%" }} /></colgroup>
        <thead><tr><th>#</th><th>Description</th><th className="r">Qty</th><th className="r">Rate</th><th className="r">Amount</th></tr></thead>
        <tbody>
          {d.lines.map((l, i) => (
            <tr key={l.id || i}>
              <td>{i + 1}</td>
              <td><b>{l.item}</b>{l.description && <div className="desc">{l.description}</div>}</td>
              <td className="r">{formatQty(l.qty)}{l.unit && <div style={{ fontSize: "7pt", color: "#6b7c95" }}>{l.unit}</div>}</td>
              <td className="r">{formatMoney(l.rate, cur)}</td>
              <td className="r">{formatMoney(lineAmount(l), cur)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <table className="pd-totals">
        <tbody>
          <tr><th>Subtotal</th><td>{formatMoney(t.subtotal, cur)}</td></tr>
          {c.vatRegistered && <tr><th>VAT ({d.vatRate}%)</th><td>{formatMoney(t.vat, cur)}</td></tr>}
          {t.discount > 0 && <tr><th>Discount</th><td>-{formatMoney(t.discount, cur)}</td></tr>}
          <tr className="grand"><th>Total {cur}</th><td>{formatMoney(t.total, cur)}</td></tr>
        </tbody>
      </table>

      <footer className="pd-foot">
        {!isQuote ? (
          <div>
            <h4>Payment details</h4>
            <div><V v={c.bankAccountName || c.legalName} /></div>
            <div><V v={c.bankName} />{c.bankBranch && <>, <V v={c.bankBranch} /></>}</div>
            {c.bankBranchCode && <div>Branch code: {c.bankBranchCode}</div>}
            <div>Account: <V v={c.bankAccount} /></div>
            {c.bankSwift && <div>SWIFT: {c.bankSwift}</div>}
            {c.bankExtra && <div className="pre">{c.bankExtra}</div>}
            <div style={{ marginTop: "2mm" }}>Reference: <b>{doc.number}</b></div>
          </div>
        ) : (
          <div>
            <h4>Acceptance</h4>
            <div>To accept, reply to this quotation or sign below.</div>
            <div style={{ marginTop: "8mm", borderTop: "0.3mm solid #9fb0c8", paddingTop: "1.5mm" }}>Name, signature and date</div>
          </div>
        )}
        {c.terms && <div><h4>Terms</h4><div className="pre">{c.terms}</div></div>}
      </footer>
      {c.footerText && <div className="pd-footer">{c.footerText}</div>}
    </article>
  );
}
