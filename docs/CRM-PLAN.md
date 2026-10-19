# Auvetric CRM — plan

Status: **approved; Phase 0 built on branch `crm`** (see `docs/CRM-RUNBOOK.md`) · Owner: Jakes & Alex · Prepared 18 Oct 2026

## 1. Goal

A private CRM behind a login on the Auvetric website, laid out like JobTracker (`F:\Projects\IOTechJobsApp`), carrying over its invoices, quotes, monthly billing, jobs board, customers, line items, company profiles and settings. It adds what a two-partner consultancy needs to win and deliver work, and shows the n8n data (incoming job listings and website enquiries) inside the CRM. Styled to the Auvetric brand guide.

## 2. Hosting decision (revised: one site at auvetric.com)

**Decision:** the CRM lives **inside the existing website** at `https://auvetric.com/crm/`. There is no separate CRM site or subdomain.

Current state (checked 18 Oct 2026): auvetric.com is live on **Netlify** (A record → Netlify load balancer, `www` → `auvetric.netlify.app`, DNS in AWS Route 53). Netlify runs the full Next.js server build, so the server API (`/api/contact`) is already live. Next.js on Netlify supports server routes and authentication natively, so the CRM adds to the same app:

| URL | What |
|---|---|
| `auvetric.com/` | Public website (unchanged) |
| `auvetric.com/crm/login` | Partner login |
| `auvetric.com/crm/…` | CRM pages: dashboard, sales, delivery, finance, admin |
| `auvetric.com/api/crm/…` | CRM server API (authenticated) |
| `auvetric.com/api/ingest/…` | n8n integration endpoints (token-authenticated) |
| `auvetric.com/api/contact` | Website form → stored in the CRM database |

- One repository (`auvetric-data-solutions`), one build, one deployment, one domain. The CRM reuses the website's design tokens and components, so it matches the brand automatically.
- `/crm/*` is excluded from search engines (`robots`, `noindex`) and served only to signed-in partners. Middleware checks the session on every `/crm` and `/api/crm` request.
- **Database (revised 19 Oct 2026):** Supabase Postgres (free: 500 MB), used purely as a database. The Next.js server connects through Supabase's **session pooler** with `DATABASE_URL`; the Supabase Data API, supabase-js and Supabase Auth are not used. Every CRM table has row-level security with no policies and the `anon`/`authenticated` roles hold no grants, so the project's public key can't read anything (verified by `npm run crm:test:supabase`). Free projects pause after about a week of low database activity; the daily job and normal use keep it awake, and a pause is undone from the dashboard.
- **Netlify plan:** the free plan's 300 credits/month cover the site's traffic, but each production deploy costs about 15 credits. Daily CRM development would use them up, and when credits run out Netlify pauses the site until the month resets. Either upgrade to **Netlify Personal ($9/month)** while building, or keep production deploys to milestones: develop locally and on a branch with previews off, and merge to `main` at each tested phase.
- **Vercel** is excluded (Hobby plan bans commercial use). **Cloudflare** remains a later option: Cloudflare Access could add an email-code gate in front of `/crm`, but that needs the DNS moved to Cloudflare and a Next.js adapter. It isn't needed now.
- The GitHub Pages copy (`enzo1826.github.io/auvetric-data-solutions`) becomes redundant once the CRM is live. Retire it or keep it as a read-only mirror without the CRM.

## 3. What carries over from JobTracker

JobTracker is Vite + React 18 + TypeScript + Zustand, with Postgres and one serverless API (about 3,500 lines). Its **logic** (VAT and totals calculation, numbering, print layout, monthly generation, Kanban) is ported into the website's Next.js app under `/crm`; **no IO Tech data** is copied. The CRM gets its own Supabase database but shares the website's repository and deployment.

| JobTracker | Auvetric CRM | Changes |
|---|---|---|
| Dashboard | Dashboard | New sales, delivery and finance widgets (section 4) |
| Invoices | Invoices | Auvetric letterhead; NAD and USD; record payments; send by email; ageing |
| Quotes | Quotes / Proposals | Optional proposal sections (scope, deliverables, assumptions, timeline) above the price table; accept/decline; convert to invoice or project |
| Monthly Billing | Retainers | Support, hosting, SLA and BI-retainer templates; auto-generate (Netlify Scheduled Function) |
| Jobs (Kanban) | **Projects** | Renamed so "Jobs" isn't confused with incoming job listings; linked client, quote, practice, partner, budget vs. actual hours |
| Customers | **Clients + Contacts** | Organisations with multiple people; activity timeline |
| Line Items | **Services catalogue** | Grouped by the four practices; rate cards (hourly, daily, fixed); USD/NAD |
| Company Profiles | Company profile | Auvetric Data Solutions letterhead from the brand kit; numbering `AUV-INV-{YYYY}-`, `AUV-QUO-{YYYY}-` |
| Settings | Settings | Users and roles, two-factor sign-in, board columns, integrations (n8n token), backup export |
| Login | Login | Branded; scrypt; HTTP-only session cookie; mandatory TOTP |

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

New: `contacts`, `leads`, `enquiries`, `opportunities`, `activities` (polymorphic: client, lead, project), `tasks`, `time_entries`, `payments`, `expenses`, `marketplace_earnings`, `attachments` (files in Netlify Blobs), `audit_log`, `integration_tokens`, `user_mfa`.

Money is stored as numeric(14,2) with a currency code and an optional exchange rate to NAD. VAT is calculated with JobTracker's verified routine (on the document total, rounded half-up). All dates use Africa/Windhoek.

## 7. Brand and interface

- The brand guide's tokens and fonts (Space Grotesk, Inter, JetBrains Mono): navy panels, Electric Blue for primary actions, Signal Cyan for data highlights, and status colours used only for meaning.
- **Dark theme by default** to match the brand, **plus a light theme toggle** for long data-entry sessions in bright offices.
- Same sidebar and top-bar structure as JobTracker, with the Auvetric lockup in the sidebar header.
- The website's footer gets a discreet **Partner login** link to `/crm/login`.
- Printed and PDF quotes and invoices stay **white A4**, with the Auvetric logo, navy text and a blue accent rule. Dark backgrounds don't print well.
- Usable on phones (installable PWA, as JobTracker is); keyboard accessible.

## 8. Security

- App login: password hash (scrypt/bcrypt on Netlify's Node runtime), HTTP-only Secure SameSite=Strict session cookie scoped to `/`, **TOTP two-factor required** for both partners, login rate limiting and lockout after repeated failures. Middleware protects every `/crm` and `/api/crm` route.
- Only Jakes and Alex have accounts; no public sign-up.
- Role model ready for more users later (admin, member, read-only).
- Ingest API: token auth, schema validation, payload size limits, rate limiting.
- Audit log of every create, update and delete on financial records.
- Backups: Supabase's free plan has no point-in-time restore, so the export is the backup: a nightly JSON/CSV export a nightly JSON/CSV export (Netlify Blobs, and optionally emailed or copied to the PC), plus the manual export button carried over from JobTracker.
- Secrets live in Netlify environment variables and are never committed.

## 9. Phases and acceptance

| Phase | Scope | Done when |
|---|---|---|
| **0 · Foundations** | Supabase project, Netlify env vars, `/crm` shell inside the website app (layout, sidebar, auth, middleware, TOTP), migrations, tests in CI, `noindex` | `auvetric.com/crm/login` live; only Jakes and Alex can sign in; public site unaffected |
| **1 · JobTracker port** | Company profile, clients and contacts, services, quotes, invoices, retainers and cron, projects board, dashboard v1, settings, print layouts | Quote → invoice → paid flow works end to end; VAT and totals match JobTracker's calculation tests; PDFs print correctly |
| **2 · Sales + n8n** (built 19 Oct 2026) | Enquiries, opportunities, leads pipeline, activities, tasks; ingest API, n8n push and pull workflows, backfill; website form → CRM | A real Upwork/LinkedIn alert appears in Opportunities within minutes; a website enquiry is stored with the PC off and triaged when it comes back on |
| **3 · Delivery + finance** (live 19 Oct 2026; emailing documents shipped in phase 4 via Zoho SMTP) | Time tracking → invoice lines, payments, expenses, marketplace earnings, debtors ageing, statements, emailing documents (Zoho transactional mail / ZeptoMail) | Monthly close: every invoice paid or aged, billable hours invoiced |
| **4 · Insights + hardening** (built 19 Oct 2026, with document email) | Reports, attachments, audit log UI, nightly backups, accessibility pass | Reports reconcile with raw data (automated checks); restore from backup tested |
| **5 · Client portal** (built 19 Oct 2026) | Client portal: email sign-in links, view quotes/invoices/statement, accept or decline quotes, EFT proof-of-payment notices. Card payments deferred until a merchant account (DPO Pay / PayToday / PayPal) exists | A client accepts a quote and reports a payment without contacting the partners |
| **Wrap-up** | Retire or freeze the GitHub Pages mirror; website form posts only to the CRM; docs and runbook | auvetric.com is the single live site with the CRM at `/crm` |

Each phase ships working software with automated tests and a live deployment, the same way the website was built.

## 10. Needed from you

- **Netlify access:** confirm the Netlify site `auvetric` deploys from the GitHub repo `EnZo1826/auvetric-data-solutions` (branch `main`), and choose Netlify Personal ($9/month) or milestone-only deploys. I'll need a Netlify personal access token, entered in the vault, to set environment variables and check deploys.
- **Supabase project:** a new project for the CRM (region East US, near Netlify's default functions region), its database password and session-pooler connection string.
- **Business details for documents:** legal name and registration number, VAT status and number (if registered), banking details for invoices, payment terms, and preferred invoice and quote number formats.
- **Who sees what:** whether Jakes and Alex both see all financials, or there is any separation (e.g. a per-partner revenue view).

## 11. Risks

- **Netlify credits:** on the free plan, frequent deploys can pause the whole site, website included. Mitigated by Personal ($9/month) or milestone deploys.
- **Shared deployment:** a CRM bug could affect the public site's build. Mitigated by CI (typecheck, lint, tests, build) before every merge and keeping CRM code isolated under `src/app/crm` and `src/crm`.
- **Supabase free plan:** pauses after about a week of low activity and allows two active free projects per owner. Mitigated by the daily job and normal use; upgrade to Pro ($25/month) if pausing ever bites or backups are needed.
- **Supabase transaction pooler (port 6543) hangs postgres.js** under concurrent queries (reproduced locally). The CRM uses the session pooler and refuses a 6543 URL at start-up.
- **The n8n side depends on the PC** for AI triage. Intake no longer does (enquiries are stored in the CRM first), but enrichment and job alerts pause while the PC is off.
- **Changing VAT or tax rules:** VAT handling stays configurable. Your accountant should confirm invoice wording and VAT registration obligations.
