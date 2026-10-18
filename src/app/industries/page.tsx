import { PageHero, CtaBand } from "@/components/sections/CtaBand";
import { IndustryExplorer } from "@/components/sections/IndustryExplorer";
import { Container, Section } from "@/components/ui/primitives";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  title: "Industries",
  description: "Retail & FMCG, manufacturing and industrial operations, logistics and fleet, security and facilities, SMEs, agriculture and remote operations.",
  path: "/industries",
});

export default function IndustriesPage() {
  return (
    <>
      <PageHero
        title={<>Where operations,<br /><span className="text-mute">systems and data meet.</span></>}
        intro="Sectors where our partners have direct experience are marked as such. Others are shown as potential applications of the same capabilities — we keep the two clearly apart."
      />
      <Section className="pt-14 sm:pt-16">
        <Container><IndustryExplorer /></Container>
      </Section>
      <CtaBand />
    </>
  );
}
