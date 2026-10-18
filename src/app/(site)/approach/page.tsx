import { PageHero, CtaBand } from "@/components/sections/CtaBand";
import { MethodologyTimeline } from "@/components/sections/MethodologyTimeline";
import { DualExpertise } from "@/components/sections/DualExpertise";
import { Container, Section, SectionHeading } from "@/components/ui/primitives";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  title: "Our Approach",
  description: "A seven-stage consulting and delivery methodology: Discover, Investigate, Architect, Engineer, Validate, Deploy, Improve.",
  path: "/approach",
});

const engagements = [
  { name: "Discovery & assessment", text: "Stages 01–03. A clear problem statement, data and systems assessment, target architecture and a phased, costed roadmap. Useful on its own before procurement." },
  { name: "Build & integrate", text: "Stages 03–06. We design, build, validate and deploy a defined solution, with documentation and handover." },
  { name: "Data & reporting improvement", text: "Stages 02, 05 and 07 focused on data quality, reconciliation, governance and reporting." },
  { name: "Ongoing improvement", text: "Stage 07 under an agreed support arrangement: monitoring, controlled enhancements, additional automation." },
];

export default function ApproachPage() {
  return (
    <>
      <PageHero
        title={<>From complexity to clarity.<br /><span className="text-mute">From requirements to real solutions.</span></>}
        intro="Every engagement moves through the same seven stages, each led by the discipline it needs most. You can engage us for a single phase or for a complete project."
      />
      <Section className="pt-16 sm:pt-20">
        <Container><MethodologyTimeline /></Container>
      </Section>

      <Section labelledBy="eng-title" className="border-t border-line bg-base">
        <Container>
          <SectionHeading id="eng-title" title="Ways to engage." intro="Engagements are scoped around the stages you need. Commercial terms are agreed per project." />
          <ul className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-line bg-line md:grid-cols-2">
            {engagements.map((e) => (
              <li key={e.name} className="bg-panel p-7">
                <h3 className="font-display text-xl text-ink">{e.name}</h3>
                <p className="mt-2 leading-relaxed text-mute">{e.text}</p>
              </li>
            ))}
          </ul>
        </Container>
      </Section>

      <Section labelledBy="dual-title" className="border-t border-line">
        <Container>
          <SectionHeading id="dual-title" title="Two disciplines in every stage." intro="Switch viewpoints to see who contributes what — and why the combined design is stronger than either alone." />
          <div className="mt-12"><DualExpertise /></div>
        </Container>
      </Section>

      <Section labelledBy="principles-title" className="border-t border-line bg-base">
        <Container>
          <SectionHeading id="principles-title" title="Working principles." />
          <dl className="mt-12 grid gap-8 md:grid-cols-3">
            {[
              ["Design for real conditions", "Intermittent connectivity, remote sites, shift work and imperfect data are requirements, not edge cases."],
              ["Make failure visible", "Stale data, failed rules and broken links should be obvious to the people relying on the system."],
              ["People decide", "Automation and AI prepare and route work. Accountable people approve what matters."],
              ["Validate before reporting", "Numbers are only presented once their source, rules and quality are known."],
              ["Work with the platform", "ERPNext, Power BI and the Microsoft stack are extended the way they are designed to be extended."],
              ["No invented outcomes", "We agree measurable targets during discovery instead of promising results in advance."],
            ].map(([t, d]) => (
              <div key={t} className="border-t border-line-strong pt-5">
                <dt className="font-display text-lg text-ink">{t}</dt>
                <dd className="mt-2 text-sm leading-relaxed text-mute">{d}</dd>
              </div>
            ))}
          </dl>
        </Container>
      </Section>
      <CtaBand />
    </>
  );
}
