/** Sales module types and constants (Phase 2), shared by the API, the ingest endpoints and the screens. */
import type { Currency, Practice } from "./types";

export const LEAD_STAGES = [
  { key: "new", label: "New", color: "#6b7c95", probability: 10 },
  { key: "qualified", label: "Qualified", color: "#00b8cc", probability: 25 },
  { key: "discovery", label: "Discovery call", color: "#0069f5", probability: 40 },
  { key: "proposal", label: "Proposal sent", color: "#8b6cf6", probability: 60 },
  { key: "negotiation", label: "Negotiation", color: "#e0a03a", probability: 80 },
  { key: "won", label: "Won", color: "#2fbf8f", probability: 100 },
  { key: "lost", label: "Lost", color: "#f16b77", probability: 0 },
] as const;
export type LeadStage = (typeof LEAD_STAGES)[number]["key"];
export const LEAD_STAGE_KEYS = LEAD_STAGES.map((s) => s.key) as LeadStage[];
export const stageLabel = (k: string) => LEAD_STAGES.find((s) => s.key === k)?.label ?? k;
export const OPEN_STAGES: LeadStage[] = ["new", "qualified", "discovery", "proposal", "negotiation"];

export const LEAD_SOURCES = ["website", "upwork", "linkedin", "referral", "direct", "other"] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export const OPP_STATUSES = ["new", "shortlisted", "applied", "interviewing", "won", "lost", "skipped"] as const;
export type OppStatus = (typeof OPP_STATUSES)[number];

export const ENQ_STATUSES = ["new", "reviewed", "converted", "spam", "archived"] as const;
export type EnqStatus = (typeof ENQ_STATUSES)[number];

export const TASK_ENTITIES = ["client", "project", "lead", "enquiry", "opportunity"] as const;
export type TaskEntity = (typeof TASK_ENTITIES)[number];

/** n8n uses data_bi / none / unclear; the CRM stores the four practice keys or null. */
export function normalisePractice(v: unknown): Practice | null {
  const s = String(v ?? "").toLowerCase();
  if (s === "data_bi" || s === "data") return "data";
  if (s === "engineering" || s === "automation" || s === "consultancy") return s;
  return null;
}

export interface EnquiryAI {
  category?: string;
  practice?: string;
  priority?: "high" | "normal" | "low";
  spam_score?: number;
  summary?: string;
  key_requirements?: string;
  questions_to_ask?: string;
  suggested_reply?: string;
  error?: string;
}

export interface Enquiry {
  id: string;
  submission_id: string;
  source: "website" | "relay" | "manual";
  submitted_at: string;
  name: string;
  organisation: string;
  email: string;
  phone: string;
  intent: string;
  interest: string;
  budget: string;
  timeline: string;
  message: string;
  status: EnqStatus;
  triage_status: "pending" | "claimed" | "done" | "failed";
  triage_attempts: number;
  triaged_at: string | null;
  ai: EnquiryAI;
  notes: string;
  client_id: string | null;
  lead_id: string | null;
}

export interface Opportunity {
  id: string;
  job_key: string;
  source: string;
  url: string;
  title: string;
  company: string;
  location: string;
  remote: string;
  employment_type: string;
  budget: string;
  skills: string;
  experience_level: string;
  summary: string;
  fit_score: number;
  practice: Practice | null;
  reasons: string;
  red_flags: string;
  action: string;
  extraction_status: string;
  received_at: string;
  status: OppStatus;
  notes: string;
  lead_id: string | null;
}

export interface Lead {
  id: string;
  title: string;
  stage: LeadStage;
  position: number;
  client_id: string | null;
  client_name?: string | null;
  contact_name: string;
  organisation: string;
  email: string;
  phone: string;
  value: number | null;
  currency: Currency;
  probability: number | null;
  practice: Practice | null;
  source: LeadSource;
  owner_user_id: string | null;
  owner_name?: string | null;
  next_follow_up: string | null;
  enquiry_id: string | null;
  opportunity_id: string | null;
  project_id: string | null;
  notes: string;
  lost_reason: string;
  closed_at: string | null;
  open_tasks?: number;
}

export interface Task {
  id: string;
  title: string;
  notes: string;
  due_date: string | null;
  done: boolean;
  done_at: string | null;
  assignee_user_id: string | null;
  assignee_name?: string | null;
  entity: TaskEntity | null;
  entity_id: string | null;
  entity_label?: string | null;
  created_at?: string;
}

/** Link to the screen that shows a task's or activity's record. */
export function entityHref(entity: string | null, id: string | null): string | null {
  if (!entity || !id) return null;
  switch (entity) {
    case "client": return `/crm/clients/${id}`;
    case "project": return `/crm/projects?open=${id}`;
    case "lead": return `/crm/leads?open=${id}`;
    case "enquiry": return `/crm/enquiries?open=${id}`;
    case "opportunity": return `/crm/opportunities?open=${id}`;
    default: return null;
  }
}
