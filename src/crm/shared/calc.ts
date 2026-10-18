/**
 * Money and date helpers shared by the CRM API, screens and print layout.
 * Ported from JobTracker's verified routine: TOTAL (excl.) → VAT on the document total
 * (rounded half-up, not per line) → discount → grand total. All arithmetic in integer cents.
 */
import type { Currency, Line } from "./types";

export const CURRENCY_SYMBOL: Record<Currency, string> = { NAD: "N$", USD: "US$" };
export const TZ = "Africa/Windhoek";

export function toCents(x: number): number {
  const n = Number(x) || 0;
  return Math.round(Number((n * 100).toFixed(6)));
}

export function lineAmountCents(l: Pick<Line, "qty" | "rate">): number {
  const q = Number(l.qty) || 0;
  const r = Number(l.rate) || 0;
  return Math.round(Number((q * r * 100).toFixed(6)));
}

export const lineAmount = (l: Pick<Line, "qty" | "rate">) => lineAmountCents(l) / 100;

export interface Totals { subtotal: number; vat: number; discount: number; total: number }

export function computeTotals(lines: Pick<Line, "qty" | "rate">[], vatRate: number, discount: number): Totals {
  const sub = lines.reduce((s, l) => s + lineAmountCents(l), 0);
  const vat = Math.round((sub * (Number(vatRate) || 0)) / 100);
  const disc = toCents(discount);
  return { subtotal: sub / 100, vat: vat / 100, discount: disc / 100, total: (sub + vat - disc) / 100 };
}

export function formatMoney(v: number, currency: Currency | string = "NAD"): string {
  const sym = CURRENCY_SYMBOL[currency as Currency] ?? currency;
  const n = Number(v) || 0;
  const s = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${n < 0 ? "-" : ""}${sym} ${s}`;
}

export function formatQty(v: number): string {
  return (Number(v) || 0).toLocaleString("en-US", { maximumFractionDigits: 3 });
}

/** YYYY-MM-DD → 18 Oct 2026 */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return "";
  return `${d} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1]} ${y}`;
}

export function formatDocNumber(prefix: string, n: number, pad: number, date?: string): string {
  const year = (date || todayISO()).slice(0, 4);
  return prefix.replace("{YYYY}", year).replace("{YY}", year.slice(2)) + String(n).padStart(pad, "0");
}

/** Today's date in Windhoek as YYYY-MM-DD (servers run in UTC). */
export function todayISO(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function endOfMonth(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
}

export function addDays(iso: string, days: number): string {
  const d = new Date(iso.slice(0, 10) + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function uid(): string {
  const a = new Uint8Array(8);
  globalThis.crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Amount in NAD for reporting (USD documents carry their own exchange rate). */
export function toNad(amount: number, currency: Currency, fx: number | null | undefined): number {
  if (currency === "NAD") return Number(amount) || 0;
  return Math.round((Number(amount) || 0) * (Number(fx) || 0) * 100) / 100;
}
