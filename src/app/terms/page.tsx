import { PageHero } from "@/components/sections/CtaBand";
import { Container, Section } from "@/components/ui/primitives";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({ title: "Terms of use", description: "Website terms of use.", path: "/terms" });

/** DRAFT — complete once the legal entity is registered. */
export default function TermsPage() {
  return (
    <>
      <PageHero title="Terms of use" intro="Draft for review before launch." />
      <Section className="pt-12">
        <Container className="max-w-3xl space-y-6 leading-relaxed text-mute">
          <p className="rounded-xl border border-warn/30 bg-warn/[0.05] p-4 text-sm text-warn">Placeholder terms. Replace with reviewed terms once the legal entity and jurisdiction details are confirmed.</p>
          <h2 className="font-display text-2xl text-ink">Website content</h2>
          <p>Content on this website describes our services and experience in general terms. It is not an offer or a guarantee of any particular outcome. Engagements are governed by a separate written agreement.</p>
          <h2 className="font-display text-2xl text-ink">Demonstrations</h2>
          <p>All interactive demonstrations use synthetic data generated for illustration. They are not connected to any client, plant, vehicle or enterprise system, and their figures do not describe any real organisation.</p>
          <h2 className="font-display text-2xl text-ink">Third-party names</h2>
          <p>Product and platform names (for example ERPNext, Power BI, Node-RED, AWS) are trademarks of their respective owners and are used only to describe compatibility and experience. No endorsement or partnership is implied.</p>
        </Container>
      </Section>
    </>
  );
}
