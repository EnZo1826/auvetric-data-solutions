# Verification — local implementation

Executed locally on October 18, 2026. These are execution results, not claims about a deployed site or real customer systems.

## Automated
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run verify:data`: all 14 KPI assertions passed against 18 synthetic records. Before: 7 valid records / 11 records with exceptions / 15 rule failures. After: 16 distinct products / 9 valid / 7 manual-review products / 8 open exceptions. Five authority-based value corrections and two duplicate merges.
- `npm run verify:telemetry`: deterministic reset, threshold alarm/clear, sensor-quality fault, outage buffer, reconnect/backfill and sequence uniqueness passed.
- `npm run build`: passed; Next generated 40 static entries (including metadata/icon assets), plus dynamic contact routes. Home first-load JS reported 149 kB; laboratory 134 kB. These are build outputs, not measured Core Web Vitals.
- `npm run verify:contact`: production route exercised against a local HTTP receiver. Acceptance → 200; receiver rejection → 502; invalid email → 422; honeypot/timing → 400; rate limit → 429. No external email sent.
- No-provider test: valid submission → 503 with explicit “Online enquiries are not yet enabled.” No false confirmation.
- All 31 sitemap page URLs returned HTTP 200 (see `route-checks.json`).
- Open Graph endpoint returned HTTP 200, `image/png`, 196661 bytes.
- Robots currently disallow indexing.

## Browser
- Desktop hero and WebGL rings/particle core inspected at 1440×900.
- Mobile 390×844: home, solutions, industries, work, approach, about, insights, contact, lab, one practice detail and one case-study detail all had scroll width equal to viewport width (390px), one h1 each. Wide tables scroll internally.
- Mobile menu opens; Escape closes it.
- Architecture switched to Enterprise Data Integrity; inspector content changed correctly. Failure simulation showed explicit failure output.
- Data demo “Run all stages” produced the reporting view and computed KPI summary.
- Work filter “Data & BI” showed five matching entries.
- Emulated reduced-motion desktop removed the WebGL canvas, preserving SVG fallback.
- Captures: `screenshots/desktop.png`, `mobile.png`, `architecture.png`, `data-report.png`.

## Dependencies
`production-audit.json`: zero vulnerabilities reported by `npm audit --omit=dev`.
`dependency-audit.json`: five high severity development-only dependency-chain findings through ESLint → fast-glob → micromatch → braces. npm did not offer an in-range braces fix at execution time. PostCSS pinned to 8.5.30 through a package override, and the full suite/build passed with that override. Review again before launch.

## Not verified / not complete
- Real Resend/mailbox acceptance and final message delivery (no credentials supplied).
- Live Turnstile challenge/verification on the chosen domain (no keys supplied). Source-review fix uses explicit render/remove lifecycle and remounts the CAPTCHA after every submission attempt so retries cannot retain consumed tokens; rebuild and no-CAPTCHA endpoint integration tests passed afterwards.
- Actual production deployment, DNS, TLS or hosted rate limiting.
- Formal WCAG audit, screen-reader matrix, Lighthouse or real Core Web Vitals.
- Real-device WebGL performance on low-powered field hardware.
- Partner approval of illustrative case-study details, outcomes, biographies and proposed philosophy copy.
- Legal review of privacy/terms.
- MDX article authoring/rendering (typed proposed-topic manifests only).

## Known operational limits
- Enquiry rate limiting is process-local. Public/serverless deployment needs Turnstile and host/WAF or shared-store limiting; proxy IP headers must be trusted only from the proxy.
- The contact endpoint rejects declared payloads over 32 KiB; enforce request-size limits at the reverse proxy/hosting layer as well.
- Build needs font-download network access on a cold font cache.
- Stop the local production server before rebuild on Windows; logs must live outside `.next`.
