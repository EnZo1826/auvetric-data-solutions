import Link from "next/link";
import { PageHero } from "@/components/sections/CtaBand";
import { Container, Section } from "@/components/ui/primitives";
import { agency } from "@/data/agency";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({ title: "Privacy notice", description: "How enquiry information is handled.", path: "/privacy" });

/** DRAFT — must be reviewed against the Namibian legal position and the chosen form provider before launch. */
export default function PrivacyPage() {
  return (
    <>
      <PageHero title="Privacy notice" intro="How we handle the information you send us." />
      <Section className="pt-12">
        <Container className="max-w-3xl space-y-6 leading-relaxed text-mute">
          <h2 className="font-display text-2xl text-ink">What we collect</h2>
          <p>When you submit an enquiry we receive the details you enter: name, organisation, email address, optional phone number, area of interest, project description, and optional budget and timeline. Your IP address is recorded for abuse prevention (rate limiting).</p>
          <h2 className="font-display text-2xl text-ink">How we use it</h2>
          <p>Only to respond to your enquiry and, if you proceed, to prepare a proposal. We do not sell your information or add you to marketing lists.</p>
          <h2 className="font-display text-2xl text-ink">Where it goes</h2>
          <p>Enquiries are stored in our customer database, which only the partners of {agency.name} can access (hosted by Supabase in the European Union, Ireland). An automation system on our own computer then reads the enquiry, prepares a summary for the partners and emails it to them. To produce that summary, the enquiry text is sent to Anthropic (the Claude AI service) under its commercial API terms, solely for this purpose; we do not use it to make automated decisions about you. Your IP address is stored with the enquiry to limit abuse.</p>
          <h2 className="font-display text-2xl text-ink">Your choices</h2>
          <p>You may ask us to access, correct or delete the information you sent by contacting us through the <Link href="/contact" className="underline">contact page</Link>.</p>
          <h2 className="font-display text-2xl text-ink">Analytics and cookies</h2>
          <p>This site does not set tracking cookies. If analytics are added later, this notice will be updated first.</p>
        </Container>
      </Section>
    </>
  );
}
