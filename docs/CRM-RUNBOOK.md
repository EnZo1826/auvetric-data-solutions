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

## Security model (Phase 0)

- Passwords: scrypt (N=2^15, r=8, p=1), 12+ characters, must not contain the email name.
- Two-factor (TOTP) is mandatory. Secrets are sealed with AES-256-GCM using `CRM_ENCRYPTION_KEY`; each code works once (replay-blocked across devices).
- Sessions: random 256-bit token in an HTTP-only, `SameSite=Strict`, `__Host-` cookie; only its SHA-256 is stored. Token rotates at every sign-in step. Idle timeout 12 h, absolute 7 days, pending sign-ins 10 min.
- Throttling: 5 wrong passwords lock the account for 15 min; 20 failures per IP per 15 min; 5 wrong codes end the pending sign-in.
- Every state-changing request must carry this site's `Origin`. Middleware blocks cookieless requests and sets `noindex`, `no-store`, `DENY` framing on every `/crm` response; `robots.txt` disallows `/crm`.
- Audit log: sign-ins, failures, lockouts, password and two-factor changes, CLI account actions.

## Production deploy (end of each phase)

1. Netlify → site `auvetric` → Extensions → **Netlify DB** (Neon). It sets `NETLIFY_DATABASE_URL`.
2. Netlify → Site configuration → Environment variables: `CRM_ENCRYPTION_KEY` (new key, generated once and stored in the password manager; never reuse the local one), scope *Functions/Runtime*.
3. From the PC, with the production URL in the environment for that shell only: `npm run crm:migrate`, then `npm run crm:user -- add` for Jakes and Alex. Hand each one-time password over in person or by phone, not email.
4. Merge `crm` → `main` (pull request, CI green). Netlify builds and deploys.
5. Check: `https://auvetric.com/crm` redirects to the login page, both partners complete enrolment, the public pages and `/robots.txt` are unchanged.

Rollback: revert the merge commit on `main`. Migrations are additive; Phase 0 tables are unused by the public site.
