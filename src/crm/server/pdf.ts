/**
 * Server-side PDFs (pdf-lib, standard Helvetica, no native dependencies) that mirror the A4 print layouts:
 * quotes/invoices (DocumentPrint.tsx) and client statements (app/crm/print/statement). Used for email attachments
 * and "Download PDF". Text outside the WinAnsi character set is transliterated or replaced with "?".
 */
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFImage, type PDFPage, type RGB } from "pdf-lib";
import { LOGO_PNG_BASE64, LOGO_SIZE } from "./assets/logo";
import { computeTotals, formatDate, formatMoney, formatQty, lineAmount } from "@/crm/shared/calc";
import { PROPOSAL_FIELDS, type CompanyData, type Currency, type DocData, type DocType } from "@/crm/shared/types";

const MM = 72 / 25.4;
const PW = 595.28, PH = 841.89;
const ML = 15 * MM, MR = 15 * MM, MT = 14 * MM, MB = 16 * MM;
const CW = PW - ML - MR;
const hex = (h: string): RGB => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);
const C = { ink: hex("#0a1830"), body: hex("#33415c"), mute: hex("#6b7c95"), mid: hex("#52647e"), blue: hex("#0058d1"), line: hex("#dde5f0"), sig: hex("#9fb0c8"), white: rgb(1, 1, 1) };
const FALLBACK: Record<string, string> = { "\u202f": " ", "\u2009": " ", "\u2007": " ", "\u2212": "-", "\u2192": "->", "\u2190": "<-", "\u2264": "<=", "\u2265": ">=", "\u2713": "v", "\u2714": "v", "\u00a0": " " };

export type Seg = { text: string; size?: number; bold?: boolean; color?: RGB };
export type Col = { w: number; label: string; align?: "left" | "right" };

export class Pdf {
  private constructor(public doc: PDFDocument, private r: PDFFont, private b: PDFFont, private logo: PDFImage, private charset: Set<number>, private cont: string) {}
  page!: PDFPage;
  y = 0;
  footerText = "";

  static async create(title: string, continuation: string) {
    const doc = await PDFDocument.create();
    doc.setTitle(title); doc.setProducer("Auvetric CRM"); doc.setCreator("Auvetric CRM");
    const r = await doc.embedFont(StandardFonts.Helvetica);
    const b = await doc.embedFont(StandardFonts.HelveticaBold);
    const logo = await doc.embedPng(Buffer.from(LOGO_PNG_BASE64, "base64"));
    const p = new Pdf(doc, r, b, logo, new Set(r.getCharacterSet()), continuation);
    p.addPage(true);
    return p;
  }

  clean(s: unknown): string {
    let out = "";
    for (const ch of String(s ?? "").replace(/\r\n?/g, "\n")) {
      if (ch === "\n") { out += ch; continue; }
      const cp = ch.codePointAt(0)!;
      if (cp < 32 || (cp >= 0x7f && cp < 0xa0)) { out += " "; continue; }
      out += FALLBACK[ch] ?? (this.charset.has(cp) ? ch : "?");
    }
    return out;
  }
  font(bold?: boolean) { return bold ? this.b : this.r; }
  width(s: string, size: number, bold?: boolean) { return this.font(bold).widthOfTextAtSize(this.clean(s), size); }

  wrap(s: unknown, size: number, width: number, bold?: boolean): string[] {
    const f = this.font(bold);
    const w = (t: string) => f.widthOfTextAtSize(t, size);
    const out: string[] = [];
    for (const para of this.clean(s).split("\n")) {
      let line = "";
      for (const word of para.split(/ +/)) {
        const cand = line ? `${line} ${word}` : word;
        if (w(cand) <= width) { line = cand; continue; }
        if (line) out.push(line);
        if (w(word) <= width) { line = word; continue; }
        let chunk = "";
        for (const ch of word) { if (chunk && w(chunk + ch) > width) { out.push(chunk); chunk = ch; } else chunk += ch; }
        line = chunk;
      }
      out.push(line);
    }
    return out;
  }

  /** Draws one line with its top at `top`. */
  line(text: string, x: number, top: number, o: { size?: number; bold?: boolean; color?: RGB; align?: "left" | "right" | "center"; width?: number } = {}) {
    const size = o.size ?? 9;
    const t = this.clean(text);
    const tw = this.font(o.bold).widthOfTextAtSize(t, size);
    const dx = o.align === "right" ? (o.width ?? 0) - tw : o.align === "center" ? ((o.width ?? 0) - tw) / 2 : 0;
    this.page.drawText(t, { x: x + dx, y: top - size * 0.86, size, font: this.font(o.bold), color: o.color ?? C.ink });
  }
  /** Wrapped paragraph from the cursor; returns its height. */
  para(text: unknown, x: number, width: number, o: { size?: number; bold?: boolean; color?: RGB; align?: "left" | "right"; lh?: number } = {}) {
    const size = o.size ?? 9, lh = size * (o.lh ?? 1.45);
    for (const l of this.wrap(text, size, width, o.bold)) {
      this.ensure(lh);
      this.line(l, x, this.y, { ...o, size, width });
      this.y -= lh;
    }
  }
  hline(x1: number, x2: number, y: number, thick = 0.85, color = C.line) {
    this.page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness: thick, color });
  }
  rect(x: number, top: number, w: number, h: number, color: RGB) { this.page.drawRectangle({ x, y: top - h, width: w, height: h, color }); }

  addPage(first = false) {
    this.page = this.doc.addPage([PW, PH]);
    this.y = PH - MT;
    if (!first) {
      this.line(this.cont, ML, this.y, { size: 8, bold: true });
      this.line("continued", ML, this.y, { size: 8, color: C.mute, align: "right", width: CW });
      this.y -= 4 * MM;
      this.hline(ML, PW - MR, this.y, 0.6);
      this.y -= 5 * MM;
    }
  }
  ensure(h: number) { if (this.y - h < MB) this.addPage(); }
  space(mm: number) { this.y -= mm * MM; }

  /** Logo left, company block right, then the blue rule. */
  letterhead(company: { name: string; data: CompanyData }) {
    const c = company.data;
    const top = this.y;
    const lw = 36 * MM, lh = (lw * LOGO_SIZE.height) / LOGO_SIZE.width;
    this.page.drawImage(this.logo, { x: ML, y: top - lh, width: lw, height: lh });
    const right = 95 * MM, rx = PW - MR - right;
    this.line(c.legalName || company.name, rx, this.y, { size: 9, bold: true, align: "right", width: right });
    this.y -= 9 * 1.5;
    const lines = [c.address, [c.phone, c.email].filter(Boolean).join(" · "), c.website, c.regNo && `Reg. no. ${c.regNo}`, c.vatRegistered && c.vatNo && `VAT no. ${c.vatNo}`]
      .filter(Boolean).join("\n");
    this.para(lines, rx, right, { size: 8, color: C.body, align: "right", lh: 1.5 });
    this.y = Math.min(this.y, top - lh) - 6 * MM;
    const steps = 48, sw = CW / steps;
    for (let i = 0; i < steps; i++) { // #0069f5 → #00d4ea
      const t = i / (steps - 1);
      this.rect(ML + i * sw, this.y, sw + 0.3, 1.5, rgb(0, (0x69 + (0xd4 - 0x69) * t) / 255, (0xf5 + (0xea - 0xf5) * t) / 255));
    }
    this.y -= 1.5 + 6 * MM;
  }

  title(left: string, right: string) {
    this.line(left, ML, this.y, { size: 18, bold: true });
    this.line(right, ML, this.y - (18 - 11) * 0.86, { size: 11, bold: true, color: C.blue, align: "right", width: CW }); // same baseline as the title
    this.y -= 18 + 5 * MM;
  }
  label(text: string, x: number, width = CW) {
    this.line(text.toUpperCase(), x, this.y, { size: 7, bold: true, color: C.mute, width });
    this.y -= 7 + 2 * MM;
  }

  /** Two-column info block: left free text block, right key/value list. */
  info(left: (x: number, w: number) => void, meta: [string, string, boolean?][]) {
    const gap = 8 * MM, lw = ((CW - gap) * 1.3) / 2.3, rw = CW - gap - lw, rx = ML + lw + gap;
    const top = this.y;
    left(ML, lw);
    const leftBottom = this.y;
    this.y = top;
    for (const [k, v, strong] of meta) {
      const kw = this.width(k, 8.5) + 5 * MM;
      const lines = this.wrap(v, 8.5, rw - kw, strong !== false);
      this.line(k, rx, this.y, { size: 8.5, color: C.mute });
      for (const l of lines) { this.line(l, rx, this.y, { size: 8.5, bold: strong !== false, align: "right", width: rw }); this.y -= 8.5 * 1.4; }
      this.y -= 1.5 * MM;
    }
    this.y = Math.min(leftBottom, this.y) - 6 * MM;
  }

  table(cols: Col[], rows: Seg[][][], o: { pad?: number; zebra?: boolean } = {}) {
    const pad = (o.pad ?? 1.9) * MM, hx = 2 * MM;
    const widths = cols.map((c) => c.w * CW);
    const head = () => {
      const h = 7.5 * 1.2 + 4.8 * MM;
      this.ensure(h + 12);
      this.rect(ML, this.y, CW, h, C.ink);
      let x = ML;
      cols.forEach((c, i) => { this.line(c.label.toUpperCase(), x + hx, this.y - 2.4 * MM, { size: 7.5, bold: true, color: C.white, align: c.align, width: widths[i] - 2 * hx }); x += widths[i]; });
      this.y -= h;
    };
    head();
    for (const row of rows) {
      const cells = row.map((segs, i) => segs.flatMap((s) => this.wrap(s.text, s.size ?? 9, widths[i] - 2 * hx, s.bold).map((t) => ({ ...s, text: t }))));
      const h = Math.max(...cells.map((ls) => ls.reduce((a, s) => a + (s.size ?? 9) * 1.4, 0))) + 2 * pad;
      if (this.y - h < MB) { this.addPage(); head(); }
      let x = ML;
      cells.forEach((ls, i) => {
        let t = this.y - pad;
        for (const s of ls) { this.line(s.text, x + hx, t, { size: s.size ?? 9, bold: s.bold, color: s.color, align: cols[i].align, width: widths[i] - 2 * hx }); t -= (s.size ?? 9) * 1.4; }
        x += widths[i];
      });
      this.y -= h;
      this.hline(ML, PW - MR, this.y);
    }
  }

  /** Right-aligned totals block. */
  totals(rows: { k: string; v: string; grand?: boolean }[]) {
    const w = 72 * MM, x = PW - MR - w;
    this.y -= 4 * MM;
    for (const r of rows) {
      const size = r.grand ? 11 : 9;
      const h = size * 1.3 + (r.grand ? 3.5 : 2.6) * MM;
      this.ensure(h);
      if (r.grand) { this.hline(x, PW - MR, this.y, 1.4, C.ink); this.y -= 2.5 * MM; } else this.y -= 1.3 * MM;
      this.line(r.k, x, this.y, { size, bold: r.grand, color: r.grand ? C.ink : C.mid });
      this.line(r.v, x, this.y, { size, bold: r.grand, align: "right", width: w });
      this.y -= size * 1.3 + 1.3 * MM;
    }
  }

  /** Two-column foot (payment details, terms), pushed to the bottom of the last page like the print layout. */
  foot(blocks: { title: string; body: string; signature?: boolean }[]) {
    const gap = 8 * MM, w = (CW - gap) / 2;
    const heightOf = (b: { body: string; signature?: boolean }) => 7 + 2 * MM + this.wrap(b.body, 7.8, w).length * 7.8 * 1.5 + (b.signature ? 12 * MM : 0);
    const h = Math.max(...blocks.map(heightOf));
    if (this.y - 7 * MM - h < MB) this.addPage();
    else this.y = MB + h; // bottom of the page, as `margin-top: auto` does in the print layout
    const top = this.y;
    blocks.forEach((b, i) => {
      this.y = top;
      const x = ML + i * (w + gap);
      this.label(b.title, x, w);
      this.para(b.body, x, w, { size: 7.8, color: C.body, lh: 1.5 });
      if (b.signature) { this.y -= 8 * MM; this.hline(x, x + w, this.y, 0.85, C.sig); this.y -= 1.5 * MM; this.line("Name, signature and date", x, this.y, { size: 7.8, color: C.body }); }
    });
  }

  async finish(): Promise<Uint8Array> {
    const pages = this.doc.getPages();
    pages.forEach((p, i) => {
      this.page = p;
      if (this.footerText || pages.length > 1) this.hline(ML, PW - MR, 11 * MM, 0.6);
      if (this.footerText) this.line(this.footerText, ML, 9.5 * MM, { size: 7, color: C.mute, align: "center", width: CW });
      if (pages.length > 1) this.line(`Page ${i + 1} of ${pages.length}`, ML, 9.5 * MM, { size: 7, color: C.mute, align: "right", width: CW });
    });
    return this.doc.save();
  }
}

export interface PdfDoc { type: DocType; number: string; date: string; due_date: string; currency: Currency; data: DocData; status?: string; amount_paid?: number | null }

export async function documentPdf(doc: PdfDoc, company: { name: string; data: CompanyData }): Promise<Uint8Array> {
  const c = company.data, d = doc.data, cur = doc.currency;
  const isQuote = doc.type === "quote";
  const title = isQuote ? "QUOTATION" : c.vatRegistered ? "TAX INVOICE" : "INVOICE";
  const pdf = await Pdf.create(`${title} ${doc.number}`, `${title} ${doc.number}`);
  pdf.footerText = c.footerText || "";
  pdf.letterhead(company);
  pdf.title(title, doc.number);
  const meta: [string, string, boolean?][] = [["Date", formatDate(doc.date)], [isQuote ? "Valid until" : "Due date", formatDate(doc.due_date)], ["Currency", cur]];
  if (d.remarks) meta.push(["Reference", d.remarks]);
  pdf.info((x, w) => {
    pdf.label(isQuote ? "Prepared for" : "Bill to", x, w);
    pdf.para(d.client.name, x, w, { size: 10.5, bold: true, lh: 1.35 });
    const rest = [d.client.contact && `Attn: ${d.client.contact}`, d.client.address, [d.client.email, d.client.phone].filter(Boolean).join(" · "), d.client.vat_no && `VAT no. ${d.client.vat_no}`].filter(Boolean).join("\n");
    if (rest) pdf.para(rest, x, w);
  }, meta);
  if (isQuote && d.proposal) for (const f of PROPOSAL_FIELDS) {
    const v = d.proposal[f.key]?.trim();
    if (!v) continue;
    pdf.ensure(30);
    pdf.para(f.label, ML, CW, { size: 9.5, bold: true, color: hex("#0058d1"), lh: 1.3 });
    pdf.para(v, ML, CW);
    pdf.space(4);
  }
  pdf.table(
    [{ w: 0.06, label: "#" }, { w: 0.48, label: "Description" }, { w: 0.11, label: "Qty", align: "right" }, { w: 0.17, label: "Rate", align: "right" }, { w: 0.18, label: "Amount", align: "right" }],
    d.lines.map((l, i) => [
      [{ text: String(i + 1) }],
      [{ text: l.item, bold: true }, ...(l.description ? [{ text: l.description, size: 8.3, color: C.body }] : [])],
      [{ text: formatQty(l.qty) }, ...(l.unit ? [{ text: l.unit, size: 7, color: C.mute }] : [])],
      [{ text: formatMoney(l.rate, cur) }],
      [{ text: formatMoney(lineAmount(l), cur) }],
    ]),
  );
  const t = computeTotals(d.lines, d.vatRate, d.discount);
  const rows: { k: string; v: string; grand?: boolean }[] = [{ k: "Subtotal", v: formatMoney(t.subtotal, cur) }];
  if (c.vatRegistered) rows.push({ k: `VAT (${d.vatRate}%)`, v: formatMoney(t.vat, cur) });
  if (t.discount > 0) rows.push({ k: "Discount", v: `-${formatMoney(t.discount, cur)}` });
  rows.push({ k: `Total ${cur}`, v: formatMoney(t.total, cur), grand: true });
  const paid = Number(doc.amount_paid ?? 0);
  if (!isQuote && paid > 0 && doc.status !== "cancelled") {
    rows.push({ k: "Paid", v: `-${formatMoney(paid, cur)}` }, { k: `Balance due ${cur}`, v: formatMoney(Math.max(0, t.total - paid), cur), grand: true });
  }
  pdf.totals(rows);
  const blocks: { title: string; body: string; signature?: boolean }[] = [];
  if (!isQuote) blocks.push({ title: "Payment details", body: bankLines(c).concat(`Reference: ${doc.number}`).join("\n") });
  else blocks.push({ title: "Acceptance", body: "To accept, reply to this quotation or sign below.", signature: true });
  if (c.terms) blocks.push({ title: "Terms", body: c.terms });
  pdf.foot(blocks);
  return pdf.finish();
}

function bankLines(c: CompanyData) {
  return [c.bankAccountName || c.legalName, [c.bankName, c.bankBranch].filter(Boolean).join(", "), c.bankBranchCode && `Branch code: ${c.bankBranchCode}`,
    `Account: ${c.bankAccount}`, c.bankSwift && `SWIFT: ${c.bankSwift}`, c.bankExtra].filter(Boolean) as string[];
}

export interface PdfStatement {
  client: { name: string; address?: string | null; email?: string | null };
  company: { name: string; data: unknown };
  from: string; to: string;
  sections: { currency: Currency; opening: number; closing: number; lines: { date: string; kind: string; ref: string; description: string; debit: number; credit: number; balance: number }[];
    ageing: { current: number; d30: number; d60: number; d90: number; d90plus: number } }[];
}

export async function statementPdf(st: PdfStatement): Promise<Uint8Array> {
  const company = { name: st.company.name, data: st.company.data as CompanyData };
  const pdf = await Pdf.create(`Statement ${st.client.name} ${st.to}`, `STATEMENT ${st.client.name}`);
  pdf.footerText = company.data.footerText || "";
  pdf.letterhead(company);
  pdf.title("STATEMENT", `${formatDate(st.from)} – ${formatDate(st.to)}`);
  pdf.info((x, w) => {
    pdf.label("Account", x, w);
    pdf.para(st.client.name, x, w, { size: 10.5, bold: true, lh: 1.35 });
    const rest = [st.client.address, st.client.email].filter(Boolean).join("\n");
    if (rest) pdf.para(rest, x, w);
  }, [["Statement date", formatDate(st.to)], ...st.sections.map((s) => [`Balance due (${s.currency})`, formatMoney(Math.max(0, s.closing), s.currency)] as [string, string])]);
  for (const s of st.sections) {
    if (st.sections.length > 1) { pdf.ensure(40); pdf.para(`${s.currency} account`, ML, CW, { size: 9, bold: true }); pdf.space(1); }
    const m = (v: number) => formatMoney(v, s.currency);
    pdf.table(
      [{ w: 0.13, label: "Date" }, { w: 0.2, label: "Reference" }, { w: 0.26, label: "Details" }, { w: 0.14, label: "Invoiced", align: "right" }, { w: 0.13, label: "Paid", align: "right" }, { w: 0.14, label: "Balance", align: "right" }],
      [
        [[{ text: formatDate(st.from) }], [{ text: "" }], [{ text: "Opening balance", bold: true }], [{ text: "" }], [{ text: "" }], [{ text: m(s.opening) }]],
        ...s.lines.map((l) => [[{ text: formatDate(l.date) }], [{ text: l.ref }],
          [{ text: l.kind === "invoice" ? `Invoice${l.description && l.description !== "Invoice" ? `: ${l.description}` : ""}` : l.description }],
          [{ text: l.debit ? m(l.debit) : "" }], [{ text: l.credit ? m(l.credit) : "" }], [{ text: m(l.balance) }]]),
      ],
    );
    pdf.space(3);
    pdf.table(
      ["Not yet due", "1–30 days", "31–60 days", "61–90 days", "90+ days", "Amount due"].map((label) => ({ w: 1 / 6, label, align: "right" as const })),
      [[...(["current", "d30", "d60", "d90", "d90plus"] as const).map((k) => [{ text: m(s.ageing[k]) }]), [{ text: m(Math.max(0, s.closing)), bold: true }]]],
    );
    pdf.space(6);
  }
  const bank = [company.data.bankName && `Bank: ${company.data.bankName}`, company.data.bankAccountName && `Account name: ${company.data.bankAccountName}`,
    company.data.bankAccount && `Account no.: ${company.data.bankAccount}`, company.data.bankBranch && `Branch: ${company.data.bankBranch}${company.data.bankBranchCode ? ` (${company.data.bankBranchCode})` : ""}`,
    company.data.bankSwift && `SWIFT: ${company.data.bankSwift}`].filter(Boolean) as string[];
  if (bank.length) {
    pdf.ensure(60);
    pdf.para("Payment details", ML, CW, { size: 9.5, bold: true, color: hex("#0058d1"), lh: 1.3 });
    pdf.para(bank.concat("Please use the invoice number as your payment reference.").join("\n"), ML, CW);
  }
  return pdf.finish();
}
