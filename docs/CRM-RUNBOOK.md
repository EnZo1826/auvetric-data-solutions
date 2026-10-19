# Auvetric CRM — runbook

The CRM lives inside the website app at `/crm` (pages) and `/api/crm` (API). Code: `src/app/crm`, `src/app/api/crm`, `src/crm`, `src/middleware.ts`. The GitHub Pages static export excludes all of it.

## Local development

```bash
npm run crm:db                       # Postgres 17 in Docker on 127.0.0.1:54329 (container auvetric-crm-db)
cp .env.example .env.local           # then set CRM_ENCRYPTION_KEY (command in the file)
npm run crm:migrate                  # apply pending migrations (--status to list only)
npm run crm:user -- add you@example.com "Your Name"   # prints a one-time password once
npm run dev                          # http://localhost:3000/crm/login
```

First sign-in: one-time password → choose a new password (12+ characters) → scan the QR code with an authenticator app → enter the code.

## Tests

| Command | What |
|---|---|
| `npm run crm:test:unit` | Base32, HOTP/TOTP against RFC 4226/6238 vectors, replay window, scrypt, password policy, AES-GCM sealing. Part of `npm run check`. |
| `npm run crm:test:calc` | Money maths ported from JobTracker: VAT on the document total (half-up), discount, cents robustness, numbering, Windhoek dates, NAD conversion. Part of `npm run check`. |
| `CRM_TEST_URL=http://localhost:3100 npm run crm:test:api` | 18 end-to-end Phase 1 groups: roles (admin/member/read-only), CSRF, company profile, clients/contacts, services, quotes/invoices (server totals, VAT off while unregistered, numbering under concurrency, USD rates, locking, convert, duplicate), projects board, retainers (once per month, also under concurrency), daily job bearer auth, timeline, users admin, backup export without secrets, print page, every Phase 1 page. |
| `npm run build && npx next start -p 3100` then `CRM_TEST_URL=http://localhost:3100 npm run crm:test:auth` | 32 end-to-end sign-in checks: gatekeeping, CSRF, enumeration, forced password change, enrolment, replay, lockout, IP throttle, session rotation, sign-out everywhere, disabled users, audit trail, public site unaffected. Refuses to run against production. |

CI (`.github/workflows/crm-ci.yml`) runs all of the above on the `crm` branch and on pull requests into `main`, plus the static Pages export (asserting no `/crm` in it).

## Account administration (CLI)

Run against the target database (`DATABASE_URL` in the environment or `.env.local`):

```bash
npm run crm:user -- list
npm run crm:user -- add <email> "<Name>" [--role admin|member|readonly]
npm run crm:user -- reset-password <email>   # new one-time password, signs out everywhere
npm run crm:user -- reset-mfa <email>        # lost phone: re-enrol at next sign-in, signs out everywhere
npm run crm:user -- unlock <email> | disable <email> | enable <email>
```

## Production state (19 Oct 2026)

- Supabase project **AuvetricCRM**, ref `qjywbkesrweqfahmgvom`, region eu-west-1 (Ireland). Migrations 0001–0003 applied; Data API lockdown verified with `crm:test:supabase` (14 tables refused). Users: Jakes and Alex (admin, one-time passwords, 2FA enrolment at first sign-in).
- Without the database password on the PC, SQL can be run through the logged-in Supabase CLI: `npx supabase db query --linked --project-ref qjywbkesrweqfahmgvom -f file.sql` (Management API, runs as `postgres`). Applying a migration this way: wrap the file in `begin; … insert into schema_migrations (name, checksum) values (…); commit;` with the same sha256 the runner computes (LF line endings).
- Netlify site `auvetric` (functions region us-east-2): `CRM_ENCRYPTION_KEY` and `CRM_CRON_SECRET` are secrets with a Production value only. The free plan can't narrow scopes below builds/functions/runtime for secrets. `DATABASE_URL` must be the Supabase **session pooler** string (port 5432).

## Phase 2: sales and the n8n link

- Modules: Enquiries, Opportunities, Leads (pipeline board), Tasks, Admin → Integrations. Migration `0004_sales.sql`.
- Website form: `CONTACT_PROVIDER=crm` (Netlify, Production) stores submissions in `enquiries`. Abuse limits: honeypot, 3 s timing trap, consent, 5 per IP per 10 minutes and 100 per hour in total (counted in the database, so they hold across serverless instances), optional Turnstile.
- Ingest API `/api/ingest/*` (outside the cookie middleware) accepts only `Authorization: Bearer auvi_…` integration tokens (sha256 stored). Endpoints: `GET /ping`, `POST /opportunities`, `POST /enquiries`, `POST /enquiries/claim`, `PATCH /enquiries/:id/triage`. n8n-owned listing fields are updated on re-ingest; status, notes and lead links set in the CRM are never overwritten.
- Triage queue: claims are atomic (`for update skip locked`), released after 20 minutes, 3 attempts; after the last failure the partners are still alerted.
- Tests: `npm run crm:test:sales` (server started with `CONTACT_PROVIDER=crm`); n8n rehearsal `python automation/test/e2e_crm_link.py`.
- Production token: CRM → Integrations → New token, paste into the n8n credential, revoke the old one.


- Supabase is used as plain Postgres. The anon/publishable key is never used by the app; the Data API would expose `public` tables to it, so migration `0003_supabase_lockdown.sql` enables RLS on every table and revokes all `anon`/`authenticated` privileges, and `crm:migrate` fails if any table is missing RLS or has such grants. **Every new migration that creates a table must enable RLS on it.**
- Connection: session pooler (port 5432). The transaction pooler (6543) hangs postgres.js when parameterless and parameterised queries are pipelined on one connection (reproduced with Supavisor 2.9.13); `db.ts` refuses a 6543 URL.
- Local Supabase check (optional): `npx supabase init` in a scratch folder, set other ports and `[db.pooler] enabled = true, pool_mode = "session"`, `npx supabase start`, then run `crm:migrate`, the auth/API suites and `crm:test:supabase` with `DATABASE_URL=postgresql://postgres.pooler-dev:postgres@127.0.0.1:<pooler-port>/postgres`.
- Free plan: pauses after about a week of low activity (resume from the dashboard; data is kept). No point-in-time restore on Free, so keep the JSON backup routine.

## Security model (Phase 0)

- Passwords: scrypt (N=2^15, r=8, p=1), 12+ characters, must not contain the email name.
- Two-factor (TOTP) is mandatory. Secrets are sealed with AES-256-GCM using `CRM_ENCRYPTION_KEY`; each code works once (replay-blocked across devices).
- Sessions: random 256-bit token in an HTTP-only, `SameSite=Strict`, `__Host-` cookie; only its SHA-256 is stored. Token rotates at every sign-in step. Idle timeout 12 h, absolute 7 days, pending sign-ins 10 min.
- Throttling: 5 wrong passwords lock the account for 15 min; 20 failures per IP per 15 min; 5 wrong codes end the pending sign-in.
- Every state-changing request must carry this site's `Origin`. Middleware blocks cookieless requests and sets `noindex`, `no-store`, `DENY` framing on every `/crm` response; `robots.txt` disallows `/crm`.
- Audit log: sign-ins, failures, lockouts, password and two-factor changes, CLI account actions.

## Phase 1 modules

Dashboard (NAD-equivalent KPIs, 12-month invoicing, deadlines), Clients & Contacts (timeline of calls/emails/meetings/notes plus system events), Services catalogue (four practices), Quotes with optional proposal sections, Invoices (NAD/USD with per-document rate), Retainers (monthly drafts, never twice per month), Projects board (drag and drop, checklist, milestones, budget), Company profile (placeholders highlighted on print), Users (one-time passwords, roles, 2FA reset), Settings (board columns, JSON backup, run daily job). A4 print at `/crm/print?ids=…` (browser Save as PDF).

Document rules: totals are always computed on the server; VAT is forced to 0 until the company is VAT-registered (documents print “INVOICE”, not “TAX INVOICE”); paid, cancelled and invoiced documents are locked; only drafts can be deleted (cancel instead, so numbers stay accounted for).

Daily job: `netlify/functions/crm-daily.mts` (Netlify Scheduled Function, 04:00 UTC = 06:00 Windhoek) POSTs to `/api/crm/cron` with `Authorization: Bearer $CRM_CRON_SECRET`. It drafts due auto-retainers and marks sent invoices past due as overdue. Admins can also run it from Settings.

## Production deploy (end of each phase)

1. Supabase → New project `auvetric-crm`, region **East US** (Netlify functions run in US East, Ohio, by default). Save the database password in the password manager. Connect → **Session pooler** gives `postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres`. Do not use the transaction pooler (port 6543); the app refuses it.
   Netlify → Environment variables: `DATABASE_URL` = that session-pooler URL.
2. Netlify → Site configuration → Environment variables (scope *Functions/Runtime*): `CRM_ENCRYPTION_KEY` (new key, generated once and stored in the password manager; never reuse the local one) and `CRM_CRON_SECRET` (32+ random characters).
3. From the PC, with the production URL in the environment for that shell only (`MIGRATE_DATABASE_URL=…`): `npm run crm:migrate` (ends with the Data API lockdown check), then `npm run crm:user -- add` for Jakes and Alex. Then prove the public key can't read anything: `SUPABASE_URL=https://<ref>.supabase.co SUPABASE_PUBLISHABLE_KEY=<publishable key> npm run crm:test:supabase`. Hand each one-time password over in person or by phone, not email.
4. Merge `crm` → `main` (pull request, CI green). Netlify builds and deploys.
5. Check: `https://auvetric.com/crm` redirects to the login page, both partners complete enrolment, the public pages and `/robots.txt` are unchanged.

Rollback: revert the merge commit on `main`. Migrations are additive; CRM tables are unused by the public site.

## Phase 4: email, attachments, backups, reports, audit log

- Migration `0006_insights.sql`: `attachments`, `emails` (sent-mail log), `backups` (register), `users.weekly_hours` (capacity for utilisation).
- **Email (Zoho Mail).** Settings → Email (admins). auvetric.com mail is on Zoho's US data centre (MX `mx.zoho.com`), so the server is `smtppro.zoho.com`, SSL, port 465; login = the full mailbox address. With two-factor sign-in on the Zoho account, use an app-specific password (Zoho Accounts → Security → App passwords). The sender address must be that mailbox or one of its Zoho aliases. The password is sealed with `CRM_ENCRYPTION_KEY` (rotating that key means re-entering it) and is never sent back to the browser. “Send test email” checks the settings. Every send (and failure, with Zoho's reason) is logged in `emails`, the audit log and the document/client timeline; the sender gets a BCC copy so it lands in Zoho. SPF (`include:zohomail.com`) and DKIM (`zmail._domainkey`) are already published for auvetric.com. Plain (unencrypted) SMTP is refused except to a local test server.
- **PDFs** are generated server-side with pdf-lib (`src/crm/server/pdf.ts`, standard Helvetica, logo in `server/assets/logo.ts`) and mirror the A4 print layouts: `GET /api/crm/documents/:id/pdf`, `GET /api/crm/clients/:id/statement/pdf?from&to`. Characters outside Latin-1 are transliterated or replaced with “?”.
- **Attachments** on clients, projects, documents, leads, expenses (receipts) and enquiries. Production stores bytes in Netlify Blobs (store `crm-files`); local dev and CI use the folder in `CRM_FILE_DIR` (`.crm-files/`, gitignored). Never set `CRM_FILE_DIR` on Netlify. Max 4 MB per file (Netlify's 6 MB request limit), extension allow-list with a content check for PDFs/images, served as downloads with `nosniff` + `sandbox` CSP. Deleting a record removes its files.
- **Backups.** The daily job (06:00 Windhoek) now also writes a gzipped JSON backup to Netlify Blobs (store `crm-backups`) and records it in `backups`; admins can “Back up now” and download any backup under Settings → Backups. Retention: 35 days, plus the first backup of each month for 13 months, plus the newest 10 manual ones. Backups contain every table except sessions, sign-in attempts and integration tokens, and no password hashes, 2FA secrets or mail password. Attachment files are not inside the backup (they stay in Blobs).
- **Restore** (tested in CI on every push):
  1. Point `DATABASE_URL` (or `MIGRATE_DATABASE_URL`) at an empty database, e.g. a new Supabase project's session pooler.
  2. `npm run crm:migrate`
  3. `npm run crm:restore -- <backup.json.gz> --yes` (`--wipe --yes` to replace a database that already has data).
  4. `npm run crm:user -- reset-password <email>` for each partner (they re-enrol 2FA at first sign-in).
  5. Re-issue the n8n token under Integrations and re-enter the mail password under Settings → Email.
- **Reports** (`/crm/reports`, `src/crm/server/reports.ts`): revenue = invoices sent/paid/overdue excl. VAT by invoice date, in NAD at each invoice's own rate; practice split over the lines (service practice → project practice → unassigned); partner = project lead, else invoice creator; cash = payments + platform net − expenses; pipeline/win rate by source (leads closed in the period); utilisation = billable ÷ (weekdays × hours per week ÷ 5); VAT working figures. `crm:test:insights` checks every breakdown sums to its headline and that invoiced, received and debtors match raw SQL.
- **Audit log** (`/crm/audit`, admins): filters by person, area, record type and dates; 100 per page (keyset); detail JSON per entry.
- **Accessibility:** skip link, focus-visible outlines, modal focus trap/restore and Escape, labelled dialogs, keyboard-operable clickable rows, reduced-motion support; axe-core (WCAG 2 A/AA) clean on the main screens in both themes. Note: React reveals streamed (Suspense) page content on the next animation frame, so automated checks must run with the tab in the foreground.
- Tests: `npm run crm:test:insights` (SMTP sink, PDF parsing, attachments, backup → restore round trip into a scratch database, reports reconciliation, audit log).

## Phase 5: client portal

- Migration `0007_portal.sql`: `clients.portal_enabled`, `portal_tokens` (one-time sign-in links, hashed), `portal_sessions` (hashed), `portal_events`, `payment_notices`.
- **Turning it on:** client page → Client portal → Switch on → Invite (the client email or any contact's email). Off by default for every client. Switching it off, or removing an address from the client/contacts, ends access on the next request.
- **Sign-in:** `/portal/login` → one-time link emailed via the CRM's SMTP settings (so Settings → Email must be set up), valid 15 minutes, single use; the link opens a page with a Sign in button so mail scanners can't use it up. Session cookie `__Host-auv_portal` (HttpOnly, Secure, SameSite=Lax), 2 h idle / 12 h maximum. Limits: 3 link requests per address and 10 per IP per 15 minutes; unknown or disabled addresses get the same answer and no email.
- **Clients see** sent/accepted/declined quotes and sent/overdue/paid invoices for their own client record(s) only (never drafts, cancelled invoices or internal notes), PDFs, and a year-to-date statement. First view of each document goes on the timeline.
- **Quote acceptance:** typed full name + tick; records name, email, time, IP and browser in `documents.data.acceptance`, marks the quote accepted, emails all active admins/members, logs timeline + audit (actor = system, `via: portal`). A portal-accepted quote can't be edited (duplicate it instead). Expired quotes (past “valid until”) can't be accepted. Decline takes an optional reason.
- **Payments:** EFT only for now (no card gateway: Stripe doesn't serve Namibia; DPO Pay/PayToday/PayPal need a merchant account). The invoice page shows the banking details (hidden until the Company profile has real bank name and account number) and an “I've paid” form: amount, date, reference, optional proof (PDF/image ≤ 4 MB, stored as a file on the invoice). Partners get an email; the notice appears on the invoice (Record payment pre-fills the payment form; Dismiss) and on the Payments page until handled. Nothing is marked paid automatically.
- Tests: `npm run crm:test:portal`.
