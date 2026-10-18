# Auvetric branding update

## Confirmed by owner
- Public name: **Auvetric Data Solutions**.
- Planned future domain: **auvetric.com**; hosting migration is deferred.
- Alex's GitHub: **https://github.com/AL3XNA** (GitHub API returned 200 for AL3XNA).
- Existing site layout and interactions are approved and must be preserved.

## Implemented locally
- Supplied logo retained in `public/brand/auvetric-logo-original.png`.
- Header/footer dark-background horizontal lockup uses original symbol and wordmark pixels; navy lettering is lightened for legibility. No logo redraw or generated substitute.
- Favicon and Open Graph image use the supplied logo.
- Blue/cyan/navy palette applied consistently to CSS, SVG illustrations and Three.js core.
- Distinct fault/error colour retained separately from engineering blue.
- New public name flows through site configuration, titles, metadata, footer and about text.
- Alex's profile link added without fabricating further biography details.

## Palette
| Role | Hex |
|---|---|
| Electric blue / engineering | #0069F5 |
| Light blue text | #77B5FF |
| Cyan / data | #00D4EA |
| Cyan text | #5AE7F2 |
| Background navy | #050B18 |
| Base navy | #091326 |
| Panel navy | #101E34 |
| Fault/error | #F16B77 |

Measured text contrast against panel: engineering text 7.82:1, cyan text 11.25:1, muted text 5.65:1 and error text 5.65:1. White on engineering fill is 4.84:1. These checks are not a full WCAG certification.

## Verification
- The brand regression test initially failed on the old agency name, then passed after implementation.
- TypeScript, ESLint, 14 data KPI assertions and deterministic telemetry tests pass.
- Pages export and base-path/static-contact tests pass.
- All 31 sitemap pages on the local static preview returned HTTP 200.
- Desktop comparison at 1440×900: all eight main homepage sections have exactly unchanged top/height/width against the approved deployed version.
- Mobile 390px: document scroll width is 390px; header logo and menu fit.
- Browser-rendered Alex link matches the supplied URL.
- Updated captures: `screenshots/auvetric-desktop.png` and `auvetric-mobile.png`.

## Publishing boundary
Prepared on branch `brand/auvetric`; the owner subsequently explicitly authorised publishing to the existing GitHub Pages URL after final review. Independent review returned no blocking source or screenshot findings within its scope. Main-branch publication is authorised; DNS/CNAME changes are not. At the owner's later request the repository was renamed to `auvetric-data-solutions`; the Pages base path and canonical URL moved to `https://enzo1826.github.io/auvetric-data-solutions/`. Legal registration and final business launch checks remain unconfirmed.
