import { PageHero, CtaBand } from "@/components/sections/CtaBand";
import { CaseStudyGallery } from "@/components/sections/CaseStudyGallery";
import { Container, Section } from "@/components/ui/primitives";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  title: "Work",
  description: "Engineering projects, data and business-intelligence experience, and clearly labelled unified concepts.",
  path: "/work",
});

export default function WorkPage() {
  return (
    <>
      <PageHero
        title={<>Work, evidence<br /><span className="text-mute">and honest labels.</span></>}
        intro="Engineering projects, data and BI experience, and agency concepts that show what the two disciplines can build together. Client identities are withheld."
      />
      <Section className="pt-14 sm:pt-16">
        <Container>
          <CaseStudyGallery />
        </Container>
      </Section>
      <CtaBand />
    </>
  );
}
