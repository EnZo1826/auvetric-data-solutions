# Auvetric CRM — plan

Status: **draft for approval** · Owner: Jakes & Alex · Prepared 18 Oct 2026

## 1. Goal

A private CRM behind a login on the Auvetric website, laid out like JobTracker (`F:\Projects\IOTechJobsApp`), carrying over its invoices, quotes, monthly billing, jobs board, customers, line items, company profiles and settings. It adds what a two-partner consultancy needs to win and deliver work, and shows the n8n data (incoming job listings and website enquiries) inside the CRM. Styled to the Auvetric brand guide.

## 2. Hosting decision

| | Cloudflare (recommended) | Netlify | Vercel |
|---|---|---|---|
| Commercial use on free plan | Allowed | Allowed | **Not allowed**: Hobby is "non-commercial personal use only", including consultants paid to build the site (Vercel fair-use guidelines) |
| Static website | Unlimited bandwidth, 500 builds/month | Free plan is **300 credits/month**: a production deploy costs about 15 credits and bandwidth about 20 credits/GB. When credits run out, every project on the team pauses until the next month | Pro $20/month |
| CRM API | Pages Functions / Workers: 100,000 requests/day free, then $5/month | Functions draw from the same 300 credits | Pro $20/month |
| Database | Neon Postgres (free: 0.5 GB, scale-to-zero) via Hyperdrive (free: 100k queries/day) | Neon / Netlify DB | Neon |
| Extra login wall | Cloudflare Access (Zero Trust) free for up to 50 users: email one-time code before the CRM even loads | Paid feature | Paid feature |
| Domain + email DNS | auvetric.com DNS can move to Cloudflare (keep the Zoho MX/SPF/DKIM records) | External DNS | External DNS |

**Netlify is possible, but it isn't the best fit here.** The free plan's 300 credits would be used up by roughly 20 deploys a month, and we deploy often while building. When that happens, both the website and the CRM go offline until the month resets. Netlify Personal ($9/month) or Pro ($20/month) would avoid that.

**Recommendation:** when auvetric.com is connected, move **both** the website and the CRM to Cloudflare:
- `auvetric.com` → website (Cloudflare Pages, the current static export, no `/auvetric-data-solutions` sub-path)
- `crm.auvetric.com` → CRM (Cloudflare Pages + Functions), protected by Cloudflare Access **and** the app's own login
- The website footer gets a discreet **Partner login** link to the CRM.

Expected cost: **$0/month** at current scale. Optional upgrades: Workers Paid ($5/month) and Neon Launch (from ~$19/month) once usage grows.

Design constraint from the free plan: **10 ms CPU per request**. Password hashing must use the platform's native WebCrypto (PBKDF2) rather than bcryptjs. PDFs stay client-side (browser print, as JobTracker does today).

## 3. What carries over from JobTracker

JobTracker is Vite + React 18 + TypeScript + Zustand, with Postgres and one serverless API (about 3,500 lines). The **code** is reused; **no IO Tech data** is copied. The Auvetric CRM gets its own repository, database and deployment.

| JobTracker | Auvetric CRM | Changes |
|---|---|---|
| Dashboard | Dashboard | New sales, delivery and finance widgets (section 4) |
| Invoices | Invoices | Auvetric letterhead; NAD and USD; record payments; send by email; ageing |
| Quotes | Quotes / Proposals | Optional proposal sections (scope, deliverables, assumptions, timeline) above the price table; accept/decline; convert to invoice or project |
| Monthly Billing | Retainers | Support, hosting, SLA and BI-retainer templates; auto-generate (Cloudflare Cron) |
| Jobs (Kanban) | **Projects** | Renamed so "Jobs" isn't confused with incoming job listings; linked client, quote, practice, partner, budget vs. actual hours |
| Customers | **Clients + Contacts** | Organisations with multiple people; activity timeline |
| Line Items | **Services catalogue** | Grouped by the four practices; rate cards (hourly, daily, fixed); USD/NAD |
| Company Profiles | Company profile | Auvetric Data Solutions letterhead from the brand kit; numbering `AUV-INV-{YYYY}-`, `AUV-QUO-{YYYY}-` |
| Settings | Settings | Users and roles, two-factor sign-in, board columns, integrations (n8n token), backup export |
| Login | Login | Branded; PBKDF2; HTTP-only session cookie; optional TOTP |

## 4. New modules for Auvetric

Sidebar in four groups (same layout pattern as JobTracker):

**Overview**
- **Dashboard:** pipeline value, new enquiries, top job matches today, active projects, hours this week, invoices overdue, retainer income this month.

**Sales**
- **Enquiries:** website form submissions with the n8n AI summary, priority, spam score and draft reply. One click converts to a lead or client.
- **Opportunities:** the Upwork/LinkedIn job feed from n8n. Fit score, practice, budget and link, filterable. Statuses: new → shortlisted → applied → interviewing → won/lost/skipped. Proposal notes and a link to the resulting lead or project.
- **Leads (pipeline):** a Kanban board (New → Qualified → Discovery call → Proposal sent → Negotiation → Won / Lost) with value, probability, owner partner, source (website, Upwork, LinkedIn, referral, direct) and next follow-up date.
- **Clients & Contacts**, with activity timelines (calls, emails, meetings, notes) and tasks.

**Delivery**
- **Projects:** a Kanban board, checklists, milestones, linked quote and invoices, practice and lead partner.
- **Time:** log hours per project and partner (billable or not). Billable time turns into invoice lines.
- **Tasks & follow-ups:** due dates and reminders, shown on the dashboard. Assigned to Jakes or Alex.

**Finance**
- **Quotes / Proposals**, **Invoices**, **Retainers** (carried over).
- **Payments:** record full or partial payments; the client account balance updates.
- **Expenses:** hosting, software and hardware, optionally re-billable to a client.
- **Marketplace earnings:** Upwork/Fiverr contract income and fees, recorded so revenue reports are complete. No invoices are needed for Upwork-paid work.

**Insights**
- **Reports:** win rate by source, pipeline by stage, revenue by practice, client and partner, recurring income, debtors ageing, a VAT summary (once VAT-registered), and hours (utilisation, billed vs. unbilled).

**Admin**
- Company profile, Services catalogue, Users (Jakes and Alex as admins), Settings, Integrations, Audit log.

## 5. n8n integration

Design rule: the CRM is the **system of record**. Your PC never has to be reachable from the internet. Website enquiries no longer depend on the PC being on.

```
Website form ──HTTPS──► CRM /api/public/enquiry ──► enquiries (status: awaiting AI triage)
                                                        ▲
n8n (PC) ──every 5 min, outbound HTTPS──► GET untriaged ─┘──► Ollama triage ──► PATCH AI fields ──► partner alert email

Upwork/LinkedIn alert email ─IMAP─► n8n ─► Ollama extract/score ─► POST /api/ingest/opportunities (upsert by job_key)
```

- **Website enquiries go straight into the CRM.** The CRM stores them even if the PC is off. This replaces the Web3Forms relay, which stays only as a fallback. n8n pulls enquiries that still need AI triage, enriches them and sends the alert.
- **Job listings:** n8n adds a "Push to CRM" step after scoring. It upserts using the existing `job_key`, so re-sends are harmless. A sync flag plus a 15-minute retry workflow covers moments when the CRM is unreachable.
- **Auth:** a dedicated integration token (rotatable in CRM Settings), stored in n8n as a Header Auth credential. Ingest endpoints accept only that token, validate every field and are rate-limited.
- **Backfill:** a one-off import of the rows already in n8n's Data Tables.
- n8n's Data Tables remain a local buffer and audit copy.

## 6. Data model (Postgres)

Carried over: `users`, `companies`, `customers`→`clients`, `items`→`services`, `documents` (quotes/invoices), `templates`→`retainers`, `jobs`→`projects`, `settings`.

New: `contacts`, `leads`, `enquiries`, `opportunities`, `activities` (polymorphic: client, lead, project), `tasks`, `time_entries`, `payments`, `expenses`, `marketplace_earnings`, `attachments` (files in Cloudflare R2, free 10 GB), `audit_log`, `integration_tokens`, `user_mfa`.

Money is stored as numeric(14,2) with a currency code and an optional exchange rate to NAD. VAT is calculated with JobTracker's verified routine (on the document total, rounded half-up). All dates use Africa/Windhoek.

## 7. Brand and interface

- The brand guide's tokens and fonts (Space Grotesk, Inter, JetBrains Mono): navy panels, Electric Blue for primary actions, Signal Cyan for data highlights, and status colours used only for meaning.
- **Dark theme by default** to match the brand, **plus a light theme toggle** for long data-entry sessions in bright offices.
- Same sidebar and top-bar structure as JobTracker, with the Auvetric lockup in the sidebar header.
- Printed and PDF quotes and invoices stay **white A4**, with the Auvetric logo, navy text and a blue accent rule. Dark backgrounds don't print well.
- Usable on phones (installable PWA, as JobTracker is); keyboard accessible.

## 8. Security

- Two gates: Cloudflare Access (email one-time code, only Jakes' and Alex's addresses allowed) **and** the app login (PBKDF2 hash, HTTP-only Secure SameSite=Strict cookie, optional TOTP two-factor).
- Role model ready for more users later (admin, member, read-only).
- Ingest API: token auth, schema validation, payload size limits, Cloudflare rate limiting.
- Audit log of every create, update and delete on financial records.
- Backups: Neon point-in-time restore (free plan: about 1 day), plus a nightly JSON/CSV export to R2, plus the manual export button carried over from JobTracker.
- Secrets live in Cloudflare environment variables and are never committed.

## 9. Phases and acceptance

| Phase | Scope | Done when |
|---|---|---|
| **0 · Foundations** | Cloudflare account and project, Neon project, repo `auvetric-crm`, CI (typecheck, lint, tests, deploy), Access policy, temporary URL `*.pages.dev` | Empty branded shell deploys from GitHub; login works behind Access |
| **1 · JobTracker port** | Auth (PBKDF2), company profile, clients and contacts, services, quotes, invoices, retainers and cron, projects board, dashboard v1, settings, print layouts | Quote → invoice → paid flow works end to end; VAT and totals match JobTracker's calculation tests; PDFs print correctly |
| **2 · Sales + n8n** | Enquiries, opportunities, leads pipeline, activities, tasks; ingest API, n8n push and pull workflows, backfill; website form → CRM | A real Upwork/LinkedIn alert appears in Opportunities within minutes; a website enquiry is stored with the PC off and triaged when it comes back on |
| **3 · Delivery + finance** | Time tracking → invoice lines, payments, expenses, marketplace earnings, debtors ageing, statements, emailing documents (Zoho transactional mail / ZeptoMail) | Monthly close: every invoice paid or aged, billable hours invoiced |
| **4 · Insights + hardening** | Reports, R2 attachments, audit log UI, TOTP, nightly backups, accessibility pass | Reports reconcile with raw data (automated checks); restore from backup tested |
| **5 · Optional** | Client portal (view and accept quotes, view invoices), online payments | Separate decision later |
| **Cut-over** | auvetric.com DNS → Cloudflare (keeping the Zoho MX/SPF/DKIM records), website moves from GitHub Pages, `crm.auvetric.com` goes live, "Partner login" link added | Website and CRM live on the domain; mail delivery unaffected |

Each phase ships working software with automated tests and a live deployment, the same way the website was built.

## 10. Needed from you

- **Cloudflare account:** create a free one, or say if you have one. I'll guide the API token setup; you enter it in the vault.
- **Where auvetric.com is registered:** needed to move DNS to Cloudflare safely.
- **Business details for documents:** legal name and registration number, VAT status and number (if registered), banking details for invoices, payment terms, and preferred invoice and quote number formats.
- **Who sees what:** whether Jakes and Alex both see all financials, or there is any separation (e.g. a per-partner revenue view).

## 11. Risks

- **The free CPU limit (10 ms) needs careful API design**: native crypto, no heavy work on the server. If a feature needs more, Workers Paid is $5/month.
- **Neon scale-to-zero** adds a few hundred milliseconds to the first request after idle. That's acceptable for a two-user CRM.
- **The n8n side depends on the PC** for AI triage. Intake no longer does (enquiries are stored in the CRM first), but enrichment and job alerts pause while the PC is off.
- **Changing VAT or tax rules:** VAT handling stays configurable. Your accountant should confirm invoice wording and VAT registration obligations.
