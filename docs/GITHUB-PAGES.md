# GitHub Pages publishing

User authorised creating a new GitHub repository and enabling GitHub Pages after the local handover.

- Repository: `https://github.com/EnZo1826/auvetric-data-solutions` (public).
- Pages target: `https://enzo1826.github.io/auvetric-data-solutions/`.

Repository renamed from `nexus-intelligence` to `auvetric-data-solutions` at the owner's request. GitHub redirects old repository/git URLs, but **GitHub Pages does not redirect** the old `/nexus-intelligence/` project path; that address stops serving after the rename. Local folder moved to `F:\Projects\Auvetric Data Solutions`.
- Publishing source: GitHub Actions, workflow `.github/workflows/pages.yml`, triggered on `main` pushes and manual dispatch.
- Node 24; `npm ci`, lint/type/data/telemetry checks, isolated static export, Pages export assertions, artifact upload and deployment.

## Static-host adaptation
The backend source remains in `src/app/api/contact/route.ts`. Only the generated Pages staging copy omits API routes. Pages contact has an explicit unavailability notice and no submission form; it does not send enquiries to a missing endpoint or show fake success. The server-hosted build retains the form and secure provider handling.

`next.config.ts` uses static export/basePath/trailingSlash only when `NEXUS_PAGES_BUILD=true`. The build script supplies `NEXT_PUBLIC_STATIC_SITE=true`, public repository base path and canonical URL. No deployment secrets are needed for the static site; GitHub uses the scoped Actions token/OIDC for Pages.

Search indexing stays disabled because the business branding, legal pages and case-study approval are not final. This is public hosting of a labelled preview, not confirmation that business/legal launch checks are completed.

## Verification contract
- Static home, contact, laboratory, normal navigation and detail routes must exist.
- Links/assets must use `/auvetric-data-solutions` prefix.
- Contact static HTML must contain the unavailability notice and no form.
- Export must not contain a fake contact API.
- `.nojekyll` must exist.

Run `npm run build:pages && npm run verify:pages`. The initial export test failed for missing output, then passed after implementation. Deployment success is only reported after the workflow and the public URL are checked remotely.
