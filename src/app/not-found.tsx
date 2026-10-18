import { ButtonLink, Container } from "@/components/ui/primitives";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";

// Lives at the root (outside the (site) group), so it brings the public chrome itself.

export default function NotFound() {
  return (
    <>
    <SiteHeader />
    <main id="main" tabIndex={-1} className="outline-none">
    <section className="relative flex min-h-[80dvh] items-center overflow-hidden pt-24">
      <div aria-hidden className="absolute inset-0 bg-grid bg-grid-fade" />
      <Container className="relative">
        <p className="font-mono text-sm text-eng-ink">404 · route not found</p>
        <h1 className="mt-4 font-display text-[clamp(2.4rem,6vw,4.5rem)] font-semibold leading-none tracking-[-0.04em]">This connection doesn’t lead anywhere.</h1>
        <p className="mt-5 max-w-[50ch] text-lg text-mute">The page may have moved, or the link may be mistyped.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink href="/">Back to home</ButtonLink>
          <ButtonLink href="/solutions" variant="ghost">View solutions</ButtonLink>
        </div>
      </Container>
    </section>
    </main>
    <SiteFooter />
    </>
  );
}
