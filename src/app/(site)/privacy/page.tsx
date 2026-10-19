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
          <p>When you submit an enquiry we receive the details you enter: name, organisation, email address, optional phone number, area of interest, project description, and optional budget and timeline. Your IP address is recorded for abuse prevention (rate limiting).</p>
          <h2 className="font-display text-2xl text-ink">How we use it</h2>
          <p>Only to respond to your enquiry and, if you proceed, to prepare a proposal. We do not sell your information or add you to marketing lists.</p>
          <h2 className="font-display text-2xl text-ink">Where it goes</h2>
          <p>Enquiries are stored in our customer database, which only the partners of {agency.name} can access (hosted by Supabase in the European Union, Ireland). An automation system on our own computer then reads the enquiry, prepares a summary for the partners and emails it to them; this summary is produced by an AI model running on that computer, and your details are not sent to an AI provider. Your IP address is stored with the enquiry to limit abuse. [Retention period to be confirmed.]</p>
          <h2 className="font-display text-2xl text-ink">Your choices</h2>
          <p>You may ask us to access, correct or delete the information you sent. [Contact address to be confirmed.]</p>
          <h2 className="font-display text-2xl text-ink">Analytics and cookies</h2>
          <p>This site does not set tracking cookies. If analytics are added later, this notice will be updated first.</p>
        </Container>
      </Section>
    </>
  );
}
