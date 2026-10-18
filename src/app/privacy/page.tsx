import { PageHero } from "@/components/sections/CtaBand";
import { Container, Section } from "@/components/ui/primitives";
import { agency } from "@/data/agency";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({ title: "Privacy notice", description: "How enquiry information is handled.", path: "/privacy" });

/** DRAFT — must be reviewed against the Namibian legal position and the chosen form provider before launch. */
export default function PrivacyPage() {
  return (
    <>
      <PageHero title="Privacy notice" intro="Draft for review before launch." />
      <Section className="pt-12">
        <Container className="max-w-3xl space-y-6 leading-relaxed text-mute">
          <p className="rounded-xl border border-warn/30 bg-warn/[0.05] p-4 text-sm text-warn">This notice is a draft placeholder. It must be reviewed and completed once the legal entity, contact address and enquiry delivery provider are confirmed.</p>
          <h2 className="font-display text-2xl text-ink">What we collect</h2>
          <p>When you submit an enquiry we receive the details you enter: name, organisation, email address, optional phone number, area of interest, project description, and optional budget and timeline. Your IP address is processed briefly for abuse prevention (rate limiting).</p>
          <h2 className="font-display text-2xl text-ink">How we use it</h2>
          <p>Only to respond to your enquiry and, if you proceed, to prepare a proposal. We do not sell your information or add you to marketing lists.</p>
          <h2 className="font-display text-2xl text-ink">Where it goes</h2>
          <p>Enquiries are delivered by email through a configured delivery provider to the partners of {agency.name}. [Provider name and data location to be confirmed.]</p>
          <h2 className="font-display text-2xl text-ink">Your choices</h2>
          <p>You may ask us to access, correct or delete the information you sent. [Contact address to be confirmed.]</p>
          <h2 className="font-display text-2xl text-ink">Analytics and cookies</h2>
          <p>This site does not set tracking cookies. If analytics are added later, this notice will be updated first.</p>
        </Container>
      </Section>
    </>
  );
}
