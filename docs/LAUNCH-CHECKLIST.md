# Launch checklist — blocked pending owner input

## Identity and content
- [ ] Confirm agency name, legal entity and domain.
- [ ] Set `agency.legalName` only once legally confirmed (enables organisation structured data).
- [ ] Confirm Alex's full public identity, biography, location and professional links; supply headshots if wanted.
- [ ] Review all founder philosophy quotations as proposed copy, not previously recorded quotations.
- [ ] Review each case study's contributor, ownership, confidentiality and technical narrative; set verified status only on evidence.
- [ ] Confirm permission to publish employer/client experience summaries.
- [ ] Replace all illustrative project implementation notes with verified descriptions, or keep clearly labelled as illustrative.
- [ ] Write and approve actual articles; MDX/article publishing is a future integration, not currently implemented.

## Enquiries / legal
- [ ] Confirm enquiry mailbox and actual provider.
- [ ] Configure sender domain and server-side secrets; test real delivery and failure/retry UX.
- [ ] Configure Turnstile plus host/WAF or shared-store rate limiting before public exposure.
- [ ] Review retention, processor/provider names, jurisdiction and enquiry consent language with suitable counsel.
- [ ] Complete privacy and terms pages (currently explicit drafts).
- [ ] Agree engagement terms and scope template separately from website terms.

## Infrastructure
- [ ] Confirm production host (must support Next server routes).
- [ ] Set canonical origin, TLS, headers and monitoring.
- [ ] Ensure trusted proxy sets forwarded headers and enforces request-size limits.
- [ ] Run dependency audit, tests, production build and actual mobile/desktop browser acceptance on deployment.
- [ ] Run Lighthouse and real-device performance checks; tune WebGL on low-powered hardware if needed.
- [ ] Review WCAG 2.2 AA with keyboard, screen reader and contrast tooling.
- [ ] Enable `NEXT_PUBLIC_ALLOW_INDEXING=true` only after final content/legal approval.

## Not authorised / not done
No GitHub push, main-branch merge, live deployment, production database operation or hardware/network configuration was performed.
