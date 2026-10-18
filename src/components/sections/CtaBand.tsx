import { ButtonLink, Container } from "@/components/ui/primitives";

export function CtaBand() {
  return (
    <section aria-labelledby="cta-title" className="relative overflow-hidden border-t border-line">
      <div aria-hidden className="absolute inset-0 bg-grid bg-grid-fade opacity-70" />
      <div aria-hidden className="absolute -left-40 top-1/2 h-96 w-96 -translate-y-1/2 rounded-full bg-eng/15 blur-[120px]" />
      <div aria-hidden className="absolute -right-40 top-1/2 h-96 w-96 -translate-y-1/2 rounded-full bg-data/15 blur-[120px]" />
      <Container className="relative py-28 sm:py-36">
        <h2 id="cta-title" className="max-w-4xl font-display text-[clamp(2.4rem,6vw,5rem)] font-semibold leading-[0.98] tracking-[-0.04em] text-balance">
          Let’s build something that works.
        </h2>
        <p className="mt-6 max-w-[60ch] text-lg leading-relaxed text-mute">
          Whether you need a custom application, better visibility into your data, connected operational systems, or a practical automation strategy, we can help define the right solution.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <ButtonLink href="/contact?intent=project">Discuss a Project</ButtonLink>
          <ButtonLink href="/contact?intent=consultation" variant="ghost">Request a Consultation</ButtonLink>
          <ButtonLink href="/contact?intent=partnership" variant="ghost">Explore a Partnership</ButtonLink>
        </div>
      </Container>
    </section>
  );
}

export function PageHero({ title, intro, children, tone = "converge" }: { title: React.ReactNode; intro?: React.ReactNode; children?: React.ReactNode; tone?: "eng" | "data" | "converge" }) {
  const glow = tone === "eng" ? "bg-eng/20" : tone === "data" ? "bg-data/20" : "bg-gradient-to-r from-eng/20 to-data/20";
  return (
    <section className="relative overflow-hidden border-b border-line pt-36 pb-16 sm:pt-44 sm:pb-24">
      <div aria-hidden className="absolute inset-0 bg-grid bg-grid-fade" />
      <div aria-hidden className={`absolute left-1/2 top-0 h-72 w-[60rem] -translate-x-1/2 rounded-full blur-[140px] ${glow}`} />
      <Container className="relative">
        <h1 className="max-w-5xl font-display text-[clamp(2.6rem,6.4vw,5.6rem)] font-semibold leading-[0.96] tracking-[-0.04em] text-balance">{title}</h1>
        {intro && <p className="mt-7 max-w-[64ch] text-lg leading-relaxed text-mute text-pretty sm:text-xl">{intro}</p>}
        {children}
      </Container>
    </section>
  );
}
