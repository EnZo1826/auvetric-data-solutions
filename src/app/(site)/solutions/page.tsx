import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { practices, statusLabel } from "@/data/practices";
import { PageHero, CtaBand } from "@/components/sections/CtaBand";
import { PracticeArt } from "@/components/illustrations/PracticeArt";
import { TechEcosystem } from "@/components/sections/TechEcosystem";
import { Container, Section, SectionHeading, cx } from "@/components/ui/primitives";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  title: "Solutions",
  description: "Four practices: Engineering & Development, Data & Business Intelligence, Automation & Intelligent Systems, and Technology Consultancy & Integration.",
  path: "/solutions",
});

const tone = { eng: "text-eng-ink", data: "text-data-ink", converge: "text-ink" } as const;
const border = { eng: "hover:border-eng/50", data: "hover:border-data/50", converge: "hover:border-ink/30" } as const;

export default function SolutionsPage() {
  return (
    <>
      <PageHero
        title={<>Four practices.<br /><span className="text-mute">One connected capability.</span></>}
        intro="Rather than advertise every technology as a separate service, we organise our work into four practices. Each can be engaged on its own — most real problems need more than one."
      />

      <Section className="pt-16 sm:pt-20">
        <Container>
          <ol className="space-y-6">
            {practices.map((p, i) => (
              <li key={p.slug}>
                <Link href={`/solutions/${p.slug}`} className={cx("group grid overflow-hidden rounded-3xl border border-line bg-panel transition-colors md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]", border[p.accent])}>
                  <div className={cx("p-7 sm:p-10", i % 2 === 1 && "md:order-2")}>
                    <p className={cx("font-mono text-sm", tone[p.accent])}>{p.index}</p>
                    <h2 className="mt-3 font-display text-[clamp(1.8rem,3.4vw,2.8rem)] leading-[1.05] tracking-[-0.03em] text-ink">{p.name}</h2>
                    <p className="mt-4 max-w-[58ch] leading-relaxed text-mute">{p.short}</p>
                    <ul className="mt-6 space-y-3">
                      {p.areas.map((a) => (
                        <li key={a.name}>
                          <p className="text-sm text-ink">{a.name}</p>
                          <p className="mt-1 text-sm text-dim">
                            {a.offerings.map((o) => o.label + (o.status && o.status !== "deliverable" ? ` (${statusLabel[o.status].toLowerCase()})` : "")).join(" · ")}
                          </p>
                        </li>
                      ))}
                    </ul>
                    <span className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-ink">
                      Problem, approach & architecture <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden />
                    </span>
                  </div>
                  <div className={cx("relative min-h-56 border-t border-line bg-base md:border-l md:border-t-0", i % 2 === 1 && "md:order-1 md:border-l-0 md:border-r")}>
                    <div aria-hidden className="absolute inset-0 bg-grid opacity-60" />
                    <div className="absolute inset-6 flex items-center"><PracticeArt slug={p.slug} /></div>
                  </div>
                </Link>
              </li>
            ))}
          </ol>
        </Container>
      </Section>

      <Section labelledBy="eco-title" className="border-t border-line bg-base">
        <Container>
          <SectionHeading
            id="eco-title"
            title="Technology ecosystem."
            intro="Grouped by what the technology does in a solution, with an honest status and the partner who brings it. Where possible, each links to the work that shows it in use."
          />
          <div className="mt-12"><TechEcosystem /></div>
        </Container>
      </Section>

      <CtaBand />
    </>
  );
}
