import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { practiceBySlug, practices, statusLabel } from "@/data/practices";
import { caseStudyBySlug } from "@/data/projects";
import { founderById } from "@/data/founders";
import { PageHero, CtaBand } from "@/components/sections/CtaBand";
import { PracticeArt } from "@/components/illustrations/PracticeArt";
import { CaseStudyCard } from "@/components/sections/CaseStudyCard";
import { ButtonLink, Container, Section, cx } from "@/components/ui/primitives";
import { pageMeta } from "@/lib/seo";

export const dynamicParams = false;

export function generateStaticParams() {
  return practices.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = practiceBySlug(slug);
  if (!p) return {};
  return pageMeta({ title: p.name, description: p.summary, path: `/solutions/${p.slug}` });
}

const nodeTone = { eng: "border-eng/50 text-eng-ink", data: "border-data/50 text-data-ink", core: "border-ink/40 text-ink" } as const;

export default async function PracticePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = practiceBySlug(slug);
  if (!p) notFound();
  const related = p.relatedProjects.map(caseStudyBySlug).filter((c) => !!c);
  const idx = practices.findIndex((x) => x.slug === p.slug);
  const next = practices[(idx + 1) % practices.length];

  return (
    <>
      <PageHero tone={p.accent === "converge" ? "converge" : p.accent} title={<><span className={cx("block font-mono text-lg tracking-normal", p.accent === "eng" ? "text-eng-ink" : p.accent === "data" ? "text-data-ink" : "text-mute")}>{p.index}</span>{p.name}</>} intro={p.summary}>
        <p className="mt-6 text-sm text-dim">Led by {p.lead.map((l) => founderById(l).displayName).join(" & ")}</p>
      </PageHero>

      {/* Problem */}
      <Section className="py-20 sm:py-24" labelledBy="problem">
        <Container className="grid gap-12 lg:grid-cols-2">
          <div>
            <h2 id="problem" className="font-display text-3xl leading-tight tracking-[-0.02em] text-ink sm:text-4xl">{p.problem.headline}</h2>
            <ul className="mt-6 space-y-3">
              {p.problem.points.map((pt) => <li key={pt} className="flex gap-3 text-mute"><span aria-hidden className="mt-2.5 size-1.5 shrink-0 rounded-full bg-warn" />{pt}</li>)}
            </ul>
          </div>
          <div className="relative min-h-60 overflow-hidden rounded-3xl border border-line bg-base">
            <div aria-hidden className="absolute inset-0 bg-grid opacity-60" />
            <div className="absolute inset-6"><PracticeArt slug={p.slug} /></div>
          </div>
        </Container>
      </Section>

      {/* Capabilities */}
      <Section className="border-t border-line bg-base py-20 sm:py-24" labelledBy="caps">
        <Container>
          <h2 id="caps" className="font-display text-3xl tracking-[-0.02em] text-ink sm:text-4xl">Solution capabilities</h2>
          <div className="mt-10 grid gap-8 md:grid-cols-2">
            {p.areas.map((a) => (
              <div key={a.name} className="border-t border-line-strong pt-6">
                <h3 className="font-display text-xl text-ink">{a.name}</h3>
                <ul className="mt-4 space-y-2.5">
                  {a.offerings.map((o) => (
                    <li key={o.label} className="flex items-baseline justify-between gap-4 text-sm">
                      <span className="text-mute">{o.label}</span>
                      {o.status && o.status !== "deliverable" && (
                        <span className={cx("shrink-0 font-mono text-[0.65rem] uppercase tracking-[0.08em]", o.status === "exploratory" ? "text-warn" : "text-data-ink")}>{statusLabel[o.status]}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-12">
            <h3 className="font-mono text-xs uppercase tracking-[0.12em] text-dim">Example use cases</h3>
            <ul className="mt-3 flex flex-wrap gap-2">{p.useCases.map((u) => <li key={u} className="rounded-full border border-line-strong px-3 py-1.5 text-sm text-mute">{u}</li>)}</ul>
          </div>
        </Container>
      </Section>

      {/* Approach + architecture */}
      <Section className="border-t border-line py-20 sm:py-24" labelledBy="approach">
        <Container className="grid gap-14 lg:grid-cols-2">
          <div>
            <h2 id="approach" className="font-display text-3xl tracking-[-0.02em] text-ink sm:text-4xl">Implementation approach</h2>
            <ol className="mt-8 space-y-6">
              {p.approach.map((a, i) => (
                <li key={a.step} className="grid grid-cols-[2.5rem_1fr] gap-3">
                  <span className="font-mono text-sm text-dim">{String(i + 1).padStart(2, "0")}</span>
                  <div><p className="text-ink">{a.step}</p><p className="mt-1 text-sm leading-relaxed text-mute">{a.detail}</p></div>
                </li>
              ))}
            </ol>
          </div>
          <div>
            <h2 className="font-display text-3xl tracking-[-0.02em] text-ink sm:text-4xl">Example architecture</h2>
            <p className="mt-3 text-sm text-dim">{p.architecture.title} — illustrative, adapted per engagement.</p>
            <ol className="mt-8 space-y-0" aria-label={p.architecture.title}>
              {p.architecture.nodes.map((n, i) => (
                <li key={n.label} className="relative pl-10">
                  {i < p.architecture.nodes.length - 1 && <span aria-hidden className="absolute left-[0.95rem] top-9 h-[calc(100%-1rem)] w-px bg-gradient-to-b from-line-strong to-line" />}
                  <span aria-hidden className={cx("absolute left-0 top-2 flex size-8 items-center justify-center rounded-lg border bg-base font-mono text-[0.65rem]", nodeTone[n.side])}>{i + 1}</span>
                  <p className={cx("pb-6 pt-3 text-sm", n.side === "core" ? "text-ink" : "text-mute")}>{n.label}</p>
                </li>
              ))}
            </ol>
            <h3 className="mt-4 font-mono text-xs uppercase tracking-[0.12em] text-dim">Applicable technologies</h3>
            <ul className="mt-3 flex flex-wrap gap-1.5">{p.technologies.map((t) => <li key={t} className="rounded-md border border-line-strong px-2 py-1 font-mono text-[0.72rem] text-mute">{t}</li>)}</ul>
          </div>
        </Container>
      </Section>

      {/* Benefits */}
      <Section className="border-t border-line bg-base py-20 sm:py-24" labelledBy="benefits">
        <Container className="grid gap-12 lg:grid-cols-[1fr_1fr]">
          <div>
            <h2 id="benefits" className="font-display text-3xl tracking-[-0.02em] text-ink sm:text-4xl">Expected categories of benefit</h2>
            <p className="mt-3 text-sm text-dim">Outcomes depend on each organisation&apos;s starting point; we agree measurable targets during discovery rather than promising them in advance.</p>
            <ul className="mt-8 space-y-3">{p.benefits.map((b) => <li key={b} className="flex gap-3 text-ink"><span aria-hidden className="mt-2.5 size-1.5 shrink-0 rounded-full bg-ok" />{b}</li>)}</ul>
          </div>
          <div>
            <h2 className="font-display text-xl text-ink">Scope notes</h2>
            <ul className="mt-4 space-y-3 text-sm text-mute">{p.notes.map((n) => <li key={n} className="border-l border-line-strong pl-4">{n}</li>)}</ul>
            <div className="mt-10 flex flex-wrap gap-3">
              <ButtonLink href={`/contact?intent=project&interest=${encodeURIComponent(p.name)}`}>Discuss a {p.name} project</ButtonLink>
              <ButtonLink href="/lab" variant="ghost">See the laboratory</ButtonLink>
            </div>
          </div>
        </Container>
      </Section>

      {related.length > 0 && (
        <Section className="border-t border-line py-20 sm:py-24" labelledBy="related">
          <Container>
            <h2 id="related" className="font-display text-3xl tracking-[-0.02em] text-ink">Related work</h2>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{related.map((c) => <li key={c!.slug}><CaseStudyCard c={c!} /></li>)}</ul>
            <Link href={`/solutions/${next.slug}`} className="mt-12 inline-flex items-center gap-2 text-ink hover:underline">Next practice: {next.index} — {next.name}<ArrowRight className="size-4" aria-hidden /></Link>
          </Container>
        </Section>
      )}
      <CtaBand />
    </>
  );
}
