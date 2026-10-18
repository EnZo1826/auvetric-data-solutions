# PRECISION INTELLIGENCE — design system

## Visual identity
User-pinned dark industrial engineering laboratory, crimson physical systems and cyan data intelligence. Convergence is communicated by connected paths, white integration nodes and occasional two-colour rules. The reference images informed the colour contrast, data-dashboard density and system-flow storytelling; they are not copied as shipping assets.

## Typography
Self-hosted by `next/font` at build time:
- Space Grotesk: display headings and lead statements.
- Inter: body and controls.
- JetBrains Mono: technical labels, measurement, data and identifiers.
Display tracking -0.02 to -0.04em; fluid headline sizes; body 16–20px; technical labels 10–12px.

## Tokens (globals.css)
| Role | Value |
|---|---|
| Void / body | #07090D |
| Base | #0D1117 |
| Panel | #121821 |
| Raised | #18212D |
| Line | #222C39 |
| Strong line | #2F3B4B |
| Primary text | #F3F6FA |
| Secondary text | #99A8BA |
| Dim text | #75849A |
| Engineering fill | #DA3633 |
| Engineering text | #F2716D |
| Data fill | #00C8D7 |
| Data text | #3FDBE6 |
| Positive | #49D7B1 |
| Warning | #F0B35A |

## Layout and components
1280px maximum content width; 20px mobile / 32px desktop gutters. Main sections 96–128px vertical padding. Desktop hero uses a 5:7 text/topology split; mobile stacks text and simplified diagram with 44px node buttons. Reusable primitives: Container, Section, SectionHeading, ButtonLink, Chip, SyntheticTag, StatusBadge.

Pill conversion buttons, 12px control radii, 16–24px panel radii; one-pixel borders. Navigation collapses below 1024px. Diagrams use real text plus equivalent touch controls. Wide data tables scroll within their own wrapper, not the page.

## Motion
Signature moment: animated nucleus and packets converging from both disciplines. R3F loaded only for capable, wider, motion-enabled clients. Paused outside viewport. SVG fallback for mobile, reduced motion and unavailable WebGL. CSS dash flow, pulse rings and restrained transition easing `cubic-bezier(.16,1,.3,1)`. Reduced-motion CSS collapses animations and suppresses decorative SMIL packets.

## Content conventions
Every simulation carries an amber synthetic-data label. Green is only a computed pass/recovery status; amber is warning/manual review; crimson represents engineering or an explicit alarm. Case-study status verification is separate from intended status. No learning technology receives a production-expertise label.

## Review scope
Desktop 1440×900 and mobile 390×844 manually inspected through the browser. Source/UI checks and tests recorded in docs/VERIFICATION.md. This is not a formal WCAG certification or a measured Lighthouse/Core Web Vitals report.
