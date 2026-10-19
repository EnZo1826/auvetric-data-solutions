/** CRM module registry: drives the sidebar and the "scheduled" placeholder pages. */
export type NavItem = {
  slug: string; // path under /crm ("" = dashboard)
  label: string;
  icon: string; // lucide icon name, resolved in the shell
  phase: number; // delivery phase; items above BUILT_PHASE render as scheduled
  summary: string;
};
export type NavGroup = { label: string; items: NavItem[] };

/** Modules that are live. Add each slug as its phase ships; everything else renders as scheduled. */
export const BUILT = new Set(["", "account", "clients", "projects", "quotes", "invoices", "retainers", "company", "services", "users", "settings",
  "enquiries", "opportunities", "leads", "tasks", "integrations", "time", "payments", "expenses", "marketplace"]);

export const NAV: NavGroup[] = [
  { label: "Overview", items: [
    { slug: "", label: "Dashboard", icon: "LayoutDashboard", phase: 0, summary: "Pipeline, delivery and finance at a glance." },
  ] },
  { label: "Sales", items: [
    { slug: "enquiries", label: "Enquiries", icon: "Inbox", phase: 2, summary: "Website form submissions with the n8n AI summary, priority and draft reply. Convert to a lead or client in one click." },
    { slug: "opportunities", label: "Opportunities", icon: "Radar", phase: 2, summary: "Upwork and LinkedIn listings from n8n with fit score, practice and budget. New → shortlisted → applied → won or lost." },
    { slug: "leads", label: "Leads", icon: "KanbanSquare", phase: 2, summary: "Pipeline board from New to Won, with value, probability, owner, source and next follow-up." },
    { slug: "clients", label: "Clients & Contacts", icon: "Building2", phase: 1, summary: "Organisations and their people, with an activity timeline." },
  ] },
  { label: "Delivery", items: [
    { slug: "projects", label: "Projects", icon: "FolderKanban", phase: 1, summary: "Project board with checklists, milestones, linked quote and invoices." },
    { slug: "time", label: "Time", icon: "Timer", phase: 3, summary: "Hours per project and partner. Billable time becomes invoice lines." },
    { slug: "tasks", label: "Tasks", icon: "ListChecks", phase: 2, summary: "Follow-ups and reminders for Jakes and Alex, surfaced on the dashboard." },
  ] },
  { label: "Finance", items: [
    { slug: "quotes", label: "Quotes", icon: "FileText", phase: 1, summary: "Quotes and proposals with scope, deliverables and timeline. Accept, decline, convert to invoice or project." },
    { slug: "invoices", label: "Invoices", icon: "Receipt", phase: 1, summary: "NAD and USD invoices on the Auvetric letterhead, with payments and ageing." },
    { slug: "retainers", label: "Retainers", icon: "Repeat", phase: 1, summary: "Support, hosting, SLA and BI retainers that generate invoices monthly." },
    { slug: "payments", label: "Payments", icon: "Banknote", phase: 3, summary: "Full and partial payments against invoices, debtors ageing and statements." },
    { slug: "expenses", label: "Expenses", icon: "Wallet", phase: 3, summary: "Hosting, software and hardware costs, optionally re-billed to clients." },
    { slug: "marketplace", label: "Marketplace", icon: "Store", phase: 3, summary: "Upwork and Fiverr contract income and fees for complete revenue reporting." },
  ] },
  { label: "Insights", items: [
    { slug: "reports", label: "Reports", icon: "BarChart3", phase: 4, summary: "Win rate, pipeline, revenue by practice and client, debtors ageing, utilisation." },
  ] },
  { label: "Admin", items: [
    { slug: "company", label: "Company profile", icon: "Landmark", phase: 1, summary: "Letterhead, registration, banking and numbering for documents." },
    { slug: "services", label: "Services", icon: "Boxes", phase: 1, summary: "Service catalogue grouped by the four practices, with rate cards." },
    { slug: "users", label: "Users", icon: "Users", phase: 1, summary: "Partner accounts, roles and two-factor status." },
    { slug: "settings", label: "Settings", icon: "Settings", phase: 1, summary: "Project board columns, backup export and the daily job." },
    { slug: "integrations", label: "Integrations", icon: "Plug", phase: 2, summary: "n8n integration token, ingest status and backfill." },
    { slug: "audit", label: "Audit log", icon: "ScrollText", phase: 4, summary: "Every create, update and delete on financial records, and every sign-in." },
    { slug: "account", label: "My account", icon: "UserCog", phase: 0, summary: "Password, sessions and theme." },
  ] },
];

export const ALL_ITEMS = NAV.flatMap((g) => g.items);
export const isBuilt = (slug: string) => BUILT.has(slug);
export const findItem = (slug: string) => ALL_ITEMS.find((i) => i.slug === slug);
