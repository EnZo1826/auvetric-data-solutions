import { PageHero, CtaBand } from "@/components/sections/CtaBand";
import { FounderProfiles } from "@/components/sections/FounderProfiles";
import { Container, Section, SectionHeading } from "@/components/ui/primitives";
import { agency } from "@/data/agency";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  title: "About",
  description: "Two complementary specialists: systems engineering and software development, and enterprise data, BI and business process optimisation.",
  path: "/about",
});

export default function AboutPage() {
  return (
    <>
      <PageHero
        title={<>Different specialisations.<br /><span className="text-mute">Shared engineering thinking.</span></>}
        intro={`${agency.name} is a two-partner practice based in ${agency.location.city}, ${agency.location.country}. One partner engineers the systems; the other makes sure the information they produce can be trusted and used. Equal partners, different disciplines.`}
      />
      <Section className="pt-16 sm:pt-20">
        <Container><FounderProfiles /></Container>
      </Section>

      <Section labelledBy="why-title" className="border-t border-line bg-base">
        <Container className="grid gap-12 lg:grid-cols-2">
          <SectionHeading id="why-title" title="Why two disciplines." />
          <div className="space-y-5 text-lg leading-relaxed text-mute">
            <p>Most technology projects fail at the join: software that captures data nobody validated, or reports built on data nobody understood at source.</p>
            <p>We understand the whole information lifecycle — how data originates in machines, people and enterprise systems; how it moves between platforms; how inconsistencies undermine decisions; and how software, automation and reporting can fix that.</p>
            <p className="text-ink">That intersection is what we offer: one team that can build the system and stand behind the numbers it produces.</p>
          </div>
        </Container>
      </Section>
      <CtaBand />
    </>
  );
}
