# Auvetric Data Solutions

A working multi-page Auvetric Data Solutions agency website for Jakes9NA and Alex, Windhoek, Namibia.

Confirmed future domain: **auvetric.com**. Current GitHub Pages URL and repository remain unchanged until an explicit domain cutover. The supplied logo and its blue/cyan/navy palette replace the former working brand; the approved layout and demonstrations are retained. Alex: https://github.com/AL3XNA.

## GitHub Pages

Repository: `EnZo1826/auvetric-data-solutions`. Publishing target: `https://enzo1826.github.io/auvetric-data-solutions/`.

The `Deploy GitHub Pages` workflow builds and deploys each push to `main`. The Pages variant is a static export: all illustrations, filters and synthetic demos run client-side, but the enquiry API is omitted. The contact page explicitly states that enquiries are unavailable instead of rendering a nonfunctional form. Search indexing remains disabled while branding/content/legal approval is pending.

```bash
npm run build:pages
npm run verify:pages
```

This uses an isolated `.pages-build` staging copy and writes the static artifact to `out/`. The normal Next server source/API is retained untouched for later Node-capable hosting. GitHub Pages does not run that API. The workflow sets the repository base path and canonical URL; update these if the repository or domain changes.

The verification and launch-review documents describe the original local handover; the subsequent GitHub Pages publishing request is tracked in `docs/GITHUB-PAGES.md`.

## Run

Requirements: Node >=22.6 and npm. Fonts are downloaded by `next/font` during the first production build and self-hosted thereafter; the build needs network access to Google Fonts.

```bash
npm ci
npm run dev -- --port 3077
```

Production preview:

```bash
npm run check
npm run build
npm start -- --port 3077
```

Open http://localhost:3077. Stop the running preview before rebuilding on Windows. Never write preview-server logs inside `.next` (Windows locks open log files and blocks build cleanup).

## Implemented

- Next.js 15 App Router, strict TypeScript, React, Tailwind 4.
- Four commercial practices with individual detail pages.
- Home, solutions, industries, work and 16 case-study detail routes, approach, about, insights, contact, privacy and terms.
- Interactive Three.js / React Three Fiber hero with pointer-responsive rings and particles, selectable capability nodes, SVG mobile/reduced-motion/WebGL-unavailable fallback.
- Architecture laboratory: three reference architectures × eight nodes; business/technical views; sample input/output; failure/recovery inspection; step/play controls.
- Deterministic industrial telemetry simulator: alarm delay, hysteresis, sensor failure, offline buffering, reconnection/backfill and reset.
- Data-integrity pipeline: 18 synthetic product records, seven stages, eight rules, before/after values, explainable corrections, exception owners and 14 computed KPIs.
- Equal founder profiles (Jakes9NA and Alex), complementary-discipline interaction, industry and technology explorers, project filters/search, methodology timeline.
- Contact endpoint with validation, honeypot, timing check, per-instance rate limiting, origin check, payload-length check and optional Turnstile; actual provider acceptance required for success.
- Metadata, canonical paths, Open Graph image, robots, sitemap. Indexing disabled by default. Organisation JSON-LD is withheld until the legal name is supplied.

## Configuration / content

Copy `.env.example` to `.env.local`. Do not commit real credentials.

| File | Edit here |
|---|---|
| `src/data/agency.ts` | Working brand, legal name, location, contact and social links |
| `src/data/founders.ts` | Names, biographies, competencies, growth areas and optional headshots |
| `src/data/practices.ts` | Four practices, capability areas, status labels and architecture |
| `src/data/projects.ts` | Case studies, verification flags, confidentiality and evidence |
| `src/data/industries.ts` | Sector experience vs applicable capabilities |
| `src/data/technologies.ts` | Technology function, partner, proficiency status and evidence |
| `src/data/insights.ts` | Proposed editorial topics (no articles invented) |
| `src/data/architectures.ts` | Laboratory node explanations and sample data |
| `src/lib/integrity.ts` | Synthetic FMCG records and transformation rules |
| `src/lib/telemetry.ts` | Deterministic telemetry simulation |
| `src/app/globals.css` | Design tokens, CSS motion and reduced-motion rules |

Content is typed TypeScript, with no paid CMS. MDX integration is **not** implemented. Proposed insights are listed as topics rather than clickable fake articles; implement an article route/content renderer before publishing articles.

## Enquiry handling

No production provider or credentials have been supplied. By default, submissions return **503 — Online enquiries are not yet enabled**, never fake success.

### Resend

Set `CONTACT_PROVIDER=resend`, `RESEND_API_KEY`, `CONTACT_TO_EMAIL`, and `CONTACT_FROM_EMAIL` (on your verified sender domain). The endpoint requires both a successful HTTP response and a provider message ID before showing success. Real email delivery has not been tested because no credentials were supplied.

### Generic webhook

Set `CONTACT_PROVIDER=webhook`, `CONTACT_WEBHOOK_URL` and optionally `CONTACT_WEBHOOK_SECRET`. The service receives structured enquiry data and a plain-text message. It must return a successful HTTP status only after accepting the enquiry. The local integration test exercises acceptance and rejection against an explicitly local receiver; it does not send email.

### Abuse protection

The bundled limiter is in-memory and per-process. Before public deployment, enable Turnstile and host-level/WAF rate limiting, or replace the limiter with a shared durable store. Never trust arbitrary `X-Forwarded-For` unless your proxy strips and sets it. Configure the public site URL to match the actual origin.

## Verification

```bash
npm run check             # strict TypeScript, ESLint, data and telemetry assertions
npm run build             # production build
npm run verify:contact    # production HTTP integration test, test receiver + port 3078
npm audit --omit=dev      # production dependency audit
```

See `docs/VERIFICATION.md` for exercised scenarios and limits. The contact test requires a production build and a free port 3078; it sends no mail.

## Deploy (not performed)

Use a Node-capable Next.js host (Vercel, Netlify Next runtime, or a Node server). Static export is unsuitable because contact processing is server-side.

1. Complete `docs/LAUNCH-CHECKLIST.md`.
2. Configure environment variables on the host, including canonical URL and enquiry provider.
3. Install with `npm ci`, build with `npm run build`, start with `npm start` (or host's Next integration).
4. If using nginx, proxy to the Node port; preserve the public Host/Origin, set forwarded headers yourself, enforce TLS and request-size/rate limits.
5. Verify a real enquiry reaches the actual mailbox/receiver. Only then enable indexing and publish the domain.
6. Back up content manifests and the lockfile. Test dependency updates with the full suite and build before deployment.

## Honest launch status

This is a **working local implementation, not a deployed or fully launch-approved business site**. Missing inputs: final brand/legal identity/domain, contact mailbox/provider credentials, approved biographies/headshots/links, verified case-study status and contributor approval, reviewed privacy/terms. Some case-study technical narratives are illustrative drafts and explicitly labelled as such. No client identities, infrastructure addresses or proprietary records are included.

The selected Next 15 stack has five transitive **development-only** audit warnings through ESLint's `braces` chain at verification time. Production audit reports zero findings after pinning PostCSS 8.5.30 via an override. Do not run `npm audit fix --force`: its proposed framework/config changes need deliberate compatibility review.
