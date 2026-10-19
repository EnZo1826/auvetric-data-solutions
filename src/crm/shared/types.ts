/** Types shared by the CRM API and screens. Ids are strings (Postgres bigint). */

export type Currency = "NAD" | "USD";
export const CURRENCIES: Currency[] = ["NAD", "USD"];

export type Practice = "engineering" | "data" | "automation" | "consultancy";
export const PRACTICES: { key: Practice; label: string; color: string }[] = [
  { key: "engineering", label: "Engineering & Development", color: "#0069f5" },
  { key: "data", label: "Data & Business Intelligence", color: "#00b8cc" },
  { key: "automation", label: "Automation & Intelligent Systems", color: "#8b6cf6" },
  { key: "consultancy", label: "Technology Consultancy & Integration", color: "#e0a03a" },
];
export const practiceLabel = (p: string | null | undefined) => PRACTICES.find((x) => x.key === p)?.label ?? "—";

export type DocType = "invoice" | "quote";
export const INVOICE_STATUSES = ["draft", "sent", "paid", "overdue", "cancelled"] as const;
export const QUOTE_STATUSES = ["draft", "sent", "accepted", "declined", "invoiced"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export interface Line {
  id: string;
  item: string;
  description: string;
  unit: string;
  qty: number;
  rate: number;
  service_id?: string | null;
}

export interface ClientSnapshot {
  name: string;
  address: string;
  email: string;
  phone: string;
  contact: string;
  vat_no: string;
}

/** Optional proposal sections printed above the price table on quotes. */
export interface ProposalSections {
  intro: string;
  scope: string;
  deliverables: string;
  assumptions: string;
  timeline: string;
}
export const PROPOSAL_FIELDS: { key: keyof ProposalSections; label: string }[] = [
  { key: "intro", label: "Introduction" },
  { key: "scope", label: "Scope of work" },
  { key: "deliverables", label: "Deliverables" },
  { key: "assumptions", label: "Assumptions & exclusions" },
  { key: "timeline", label: "Timeline" },
];

export interface DocData {
  client: ClientSnapshot;
  remarks: string;
  lines: Line[];
  discount: number;
  vatRate: number;
  notes: string; // internal, never printed
  proposal?: ProposalSections;
}

export interface Doc {
  id: string;
  type: DocType;
  number: string;
  company_id: string;
  client_id: string | null;
  contact_id: string | null;
  project_id: string | null;
  retainer_id: string | null;
  source_id: string | null;
  status: string;
  date: string;
  due_date: string;
  period: string | null;
  currency: Currency;
  fx_rate: number | null;
  data: DocData;
  subtotal: number;
  vat: number;
  discount: number;
  total: number;
  amount_paid?: number;
  sent_at: string | null;
  paid_at: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface DocListRow {
  id: string;
  type: DocType;
  number: string;
  status: string;
  date: string;
  due_date: string;
  currency: Currency;
  fx_rate: number | null;
  total: number;
  amount_paid?: number;
  client_id: string | null;
  client_name: string;
  project_id: string | null;
  retainer_id: string | null;
  remarks: string;
}

export interface CompanyData {
  legalName: string;
  tradingName: string;
  regNo: string;
  vatRegistered: boolean;
  vatNo: string;
  vatRate: number; // applied only when vatRegistered
  address: string;
  email: string;
  phone: string;
  website: string;
  bankName: string;
  bankAccountName: string;
  bankBranch: string;
  bankBranchCode: string;
  bankAccount: string;
  bankSwift: string;
  bankExtra: string;
  paymentTermsDays: number;
  quoteValidDays: number;
  terms: string;
  invoicePrefix: string;
  quotePrefix: string;
  numberPad: number;
  nextInvoice: number;
  nextQuote: number;
  defaultCurrency: Currency;
  usdToNad: number; // default exchange rate offered on USD documents
  footerText: string;
}

export interface Company { id: string; name: string; data: CompanyData; updated_at?: string }

/** Placeholders until the partners supply real details (shown with a warning in Company profile). */
export const PLACEHOLDER = "[to be confirmed]";

export interface Client {
  id: string;
  name: string;
  trading_name: string;
  industry: string;
  address: string;
  email: string;
  phone: string;
  website: string;
  vat_no: string;
  reg_no: string;
  currency: Currency;
  payment_terms_days: number | null;
  notes: string;
  tags: string[];
  archived: boolean;
  created_at?: string;
}

export interface Contact {
  id: string;
  client_id: string;
  name: string;
  role: string;
  email: string;
  phone: string;
  is_primary: boolean;
  notes: string;
}

export interface Service {
  id: string;
  practice: Practice;
  code: string;
  name: string;
  description: string;
  unit: string;
  rate: number;
  currency: Currency;
  active: boolean;
}

export const RETAINER_KINDS = ["support", "hosting", "sla", "bi", "other"] as const;
export type RetainerKind = (typeof RETAINER_KINDS)[number];
export const RETAINER_LABEL: Record<RetainerKind, string> = { support: "Support", hosting: "Hosting", sla: "SLA", bi: "BI retainer", other: "Other" };

export interface Retainer {
  id: string;
  company_id: string;
  client_id: string;
  client_name?: string;
  name: string;
  kind: RetainerKind;
  currency: Currency;
  active: boolean;
  auto: boolean;
  day_of_month: number;
  last_period: string | null;
  data: { lines: Line[]; remarks: string; discount: number };
}

export interface ChecklistItem { id: string; text: string; done: boolean }
export interface Milestone { id: string; title: string; due: string | null; done: boolean }

export interface Project {
  id: string;
  title: string;
  client_id: string | null;
  client_name?: string;
  status: string;
  priority: "low" | "normal" | "high" | "urgent";
  position: number;
  practice: Practice | null;
  lead_user_id: string | null;
  start_date: string | null;
  due_date: string | null;
  budget_amount: number | null;
  budget_currency: Currency;
  budget_hours: number | null;
  quote_id: string | null;
  data: {
    description: string;
    checklist: ChecklistItem[];
    milestones: Milestone[];
    tags: string[];
    hours: number;
  };
  created_at?: string;
  updated_at?: string;
}

export interface BoardColumn { key: string; label: string; color: string }
export const DEFAULT_PROJECT_COLUMNS: BoardColumn[] = [
  { key: "planned", label: "Planned", color: "#6b7c95" },
  { key: "in_progress", label: "In progress", color: "#0069f5" },
  { key: "waiting", label: "Waiting on client", color: "#8b6cf6" },
  { key: "review", label: "Review / UAT", color: "#e0a03a" },
  { key: "done", label: "Done", color: "#2fbf8f" },
];

export interface Activity {
  id: string;
  entity: string;
  entity_id: string;
  kind: "note" | "call" | "email" | "meeting" | "system";
  body: string;
  at: string;
  user_id: string | null;
  user_name: string | null;
}

export interface UserRow {
  id: string;
  email: string;
  name: string;
  role: "admin" | "member" | "readonly";
  totp_enabled: boolean;
  disabled: boolean;
  last_login_at: string | null;
  locked: boolean;
  weekly_hours?: number;
}
