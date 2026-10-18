import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { HeroSystem } from "@/components/hero/HeroSystem";
import { PracticeExplorer } from "@/components/sections/PracticeExplorer";
import { DualExpertise } from "@/components/sections/DualExpertise";
import { ArchitectureLab } from "@/components/demos/ArchitectureLab";
import { CaseStudyCard } from "@/components/sections/CaseStudyCard";
import { MethodologyTimeline } from "@/components/sections/MethodologyTimeline";
import { FounderProfiles } from "@/components/sections/FounderProfiles";
import { CtaBand } from "@/components/sections/CtaBand";
import { ButtonLink, Container, Section, SectionHeading } from "@/components/ui/primitives";
import { caseStudies } from "@/data/projects";

export default function HomePage() {
  const featured = caseStudies.filter((c) => c.featured).slice(0, 6);
  return (
    <>
      {/* A — Hero */}
      <section className="relative overflow-hidden pt-28 sm:pt-32" aria-labelledby="hero-title">
        <div aria-hidden className="absolute inset-0 bg-grid bg-grid-fade" />
        <div aria-hidden className="absolute left-[8%] top-40 h-80 w-80 rounded-full bg-eng/12 blur-[130px]" />
        <div aria-hidden className="absolute right-[8%] top-60 h-80 w-80 rounded-full bg-data/12 blur-[130px]" />
        <Container className="relative grid items-center gap-10 pb-16 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-6 lg:pb-24">
          <div className="rise-in">
            <p className="font-mono text-xs tracking-[0.22em] text-mute">
              <span className="text-eng-ink">ENGINEERING</span> × <span className="text-data-ink">DATA</span> × INTELLIGENCE
            </p>
            <h1 id="hero-title" className="mt-6 font-display text-[clamp(2.7rem,5.6vw,5.4rem)] font-semibold leading-[0.95] tracking-[-0.045em]">
              <span className="block">We connect systems.</span>
              <span className="block text-mute">We engineer intelligence.</span>
            </h1>
            <p className="mt-7 max-w-[52ch] text-lg leading-relaxed text-mute">
              We design connected software, intelligent automation, reliable data solutions, and operational technology that help businesses work smarter, respond faster, and make better decisions.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <ButtonLink href="/solutions">Explore Our Solutions</ButtonLink>
              <ButtonLink href="/contact?intent=project" variant="ghost">Discuss Your Project</ButtonLink>
            </div>
            <p className="mt-10 font-mono text-xs text-dim">Windhoek, Namibia · serving local, regional and international clients</p>
          </div>
          <div className="rise-in [animation-delay:150ms]">
            <HeroSystem />
          </div>
        </Container>
      </section>

      {/* B — Practices with capability-based navigation */}
      <Section labelledBy="practices-title" className="border-t border-line">
        <Container>
          <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
            <SectionHeading
              id="practices-title"
              title="Four practices. One connected capability."
              intro="We organise our work by the problems it solves, not by a list of technologies. Choose the perspective that suits you — both lead to the same information."
            />
            <Link href="/solutions" className="inline-flex items-center gap-2 text-sm text-ink hover:underline">
              All solutions <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
          <div className="mt-14"><PracticeExplorer /></div>
        </Container>
      </Section>

      {/* C — Two disciplines */}
      <Section labelledBy="dual-title" className="border-t border-line bg-base">
        <Container>
          <SectionHeading
            id="dual-title"
            title="Two disciplines. One connected solution."
            intro="One partner understands how to build and connect the systems. The other understands how to validate, interpret and use the information those systems produce. Switch viewpoints to see how they fit together."
          />
          <div className="mt-14"><DualExpertise /></div>
        </Container>
      </Section>

      {/* D — Laboratory */}
      <Section id="lab" labelledBy="lab-title" className="border-t border-line">
        <Container>
          <SectionHeading
            id="lab-title"
            title="Explore how our solutions work."
            intro="Three reference architectures you can take apart. Select any stage to see its purpose, the technology involved, sample inputs and outputs, what goes wrong — and how a well-built system recovers."
          />
          <div className="mt-14"><ArchitectureLab /></div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <Link href="/lab#telemetry" className="group relative overflow-hidden rounded-2xl border border-eng/30 bg-panel p-6 transition-colors hover:border-eng/60">
              <p className="font-mono text-xs uppercase tracking-[0.12em] text-eng-ink">Demonstration · Industrial monitoring</p>
              <h3 className="mt-2 font-display text-2xl tracking-[-0.02em] text-ink">From the physical world to digital intelligence</h3>
              <p className="mt-2 text-sm leading-relaxed text-mute">Trigger a threshold alarm, a sensor fault or a network outage, and watch the edge buffer and back-fill without losing data.</p>
              <span className="mt-5 inline-flex items-center gap-2 text-sm text-ink">Open the demo <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden /></span>
            </Link>
            <Link href="/lab#data-integrity" className="group relative overflow-hidden rounded-2xl border border-data/30 bg-panel p-6 transition-colors hover:border-data/60">
              <p className="font-mono text-xs uppercase tracking-[0.12em] text-data-ink">Demonstration · Data integrity</p>
              <h3 className="mt-2 font-display text-2xl tracking-[-0.02em] text-ink">From inconsistent data to trusted intelligence</h3>
              <p className="mt-2 text-sm leading-relaxed text-mute">Run a synthetic FMCG product file through seven stages, from profiling to reconciliation, with every figure reproducible.</p>
              <span className="mt-5 inline-flex items-center gap-2 text-sm text-ink">Open the demo <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden /></span>
            </Link>
          </div>
        </Container>
      </Section>

      {/* E — Work */}
      <Section labelledBy="work-title" className="border-t border-line bg-base">
        <Container>
          <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
            <SectionHeading
              id="work-title"
              title="Work that runs in the real world."
              intro="Engineering projects, data and BI experience, and clearly labelled concepts that show what the two disciplines can do together. Client names are withheld; statuses are shown as verified or pending."
            />
            <Link href="/work" className="inline-flex items-center gap-2 text-sm text-ink hover:underline">All work <ArrowRight className="size-4" aria-hidden /></Link>
          </div>
          <ul className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((c) => <li key={c.slug}><CaseStudyCard c={c} /></li>)}
          </ul>
        </Container>
      </Section>

      {/* F — Approach */}
      <Section labelledBy="approach-title" className="border-t border-line">
        <Container>
          <SectionHeading
            id="approach-title"
            title="From complexity to clarity. From requirements to real solutions."
            intro="Seven stages, led by whichever discipline the stage needs. Engage us for a single phase or a complete project."
          />
          <div className="mt-14"><MethodologyTimeline compact /></div>
          <Link href="/approach" className="mt-8 inline-flex items-center gap-2 text-sm text-ink hover:underline">How we work <ArrowRight className="size-4" aria-hidden /></Link>
        </Container>
      </Section>

      {/* G — Founders */}
      <Section labelledBy="founders-title" className="border-t border-line bg-base">
        <Container>
          <SectionHeading id="founders-title" title="Different specialisations. Shared engineering thinking." />
          <div className="mt-14"><FounderProfiles compact /></div>
          <Link href="/about" className="mt-8 inline-flex items-center gap-2 text-sm text-ink hover:underline">Full profiles <ArrowRight className="size-4" aria-hidden /></Link>
        </Container>
      </Section>

      <CtaBand />
    </>
  );
}
