# AUVETRIC DATA SOLUTIONS — design system

## Visual identity
User-approved existing layout retained. Supplied Auvetric logo governs electric-blue engineering, bright-cyan data and navy surfaces. Convergence is communicated by connected paths, white integration nodes and occasional two-colour rules. The reference images informed the colour contrast, data-dashboard density and system-flow storytelling; they are not copied as shipping assets.

## Logo assets
Original supplied logo is retained in public/brand/auvetric-logo-original.png. Header/footer use a compact horizontal adaptation made from the original symbol and wordmark pixels, with navy lettering lightened for dark-background contrast. Proportions are preserved; provenance is recorded in public/brand/PROVENANCE.json. No typeface, spacing, section order or interaction redesign is part of this change.

## Typography
Self-hosted by `next/font` at build time:
- Space Grotesk: display headings and lead statements.
- Inter: body and controls.
- JetBrains Mono: technical labels, measurement, data and identifiers.
Display tracking -0.02 to -0.04em; fluid headline sizes; body 16–20px; technical labels 10–12px.

## Tokens (globals.css)
| Role | Value |
|---|---|
| Void / body | #050B18 |
| Base | #091326 |
| Panel | #101E34 |
| Raised | #172B46 |
| Line | #203651 |
| Strong line | #304D70 |
| Primary text | #F3F7FF |
| Secondary text | #9DAFC8 |
| Dim text | #8298B5 |
| Engineering fill | #0069F5 |
| Engineering text | #77B5FF |
| Data fill | #00D4EA |
| Data text | #5AE7F2 |
| Positive | #49D7B1 |
| Warning | #F0B35A |
| Fault / error | #F16B77 |

## Layout and components
1280px maximum content width; 20px mobile / 32px desktop gutters. Main sections 96–128px vertical padding. Desktop hero uses a 5:7 text/topology split; mobile stacks text and simplified diagram with 44px node buttons. Reusable primitives: Container, Section, SectionHeading, ButtonLink, Chip, SyntheticTag, StatusBadge.

Pill conversion buttons, 12px control radii, 16–24px panel radii; one-pixel borders. Navigation collapses below 1024px. Diagrams use real text plus equivalent touch controls. Wide data tables scroll within their own wrapper, not the page.

## Motion
Signature moment: animated nucleus and packets converging from both disciplines. R3F loaded only for capable, wider, motion-enabled clients. Paused outside viewport. SVG fallback for mobile, reduced motion and unavailable WebGL. CSS dash flow, pulse rings and restrained transition easing `cubic-bezier(.16,1,.3,1)`. Reduced-motion CSS collapses animations and suppresses decorative SMIL packets.

## Content conventions
Every simulation carries an amber synthetic-data label. Green is only a computed pass/recovery status; amber is warning/manual review; electric blue represents engineering; pink/red is reserved for explicit errors and alarms. Case-study status verification is separate from intended status. No learning technology receives a production-expertise label.

## Review scope
Desktop 1440×900 and mobile 390×844 manually inspected through the browser. Source/UI checks and tests recorded in docs/VERIFICATION.md. This is not a formal WCAG certification or a measured Lighthouse/Core Web Vitals report.
