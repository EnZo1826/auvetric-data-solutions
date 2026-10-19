import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, ExternalLink } from "lucide-react";
import { caseStudies, caseStudyBySlug } from "@/data/projects";
import { founderById } from "@/data/founders";
import { practiceBySlug } from "@/data/practices";
import { CtaBand } from "@/components/sections/CtaBand";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ButtonLink, Container, cx } from "@/components/ui/primitives";
import { pageMeta } from "@/lib/seo";

export const dynamicParams = false;

export function generateStaticParams() {
  return caseStudies.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = caseStudyBySlug(slug);
  if (!c) return {};
  return { ...pageMeta({ title: c.title, description: c.shortDescription, path: `/work/${c.slug}` }), openGraph: { type: "article", title: c.title, description: c.shortDescription } };
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line pt-8">
      <h2 className="font-display text-2xl tracking-[-0.02em] text-ink">{title}</h2>
      <div className="mt-4 leading-relaxed text-mute">{children}</div>
    </section>
  );
}

const List = ({ items }: { items: string[] }) => (
  <ul className="space-y-2">{items.map((i) => <li key={i} className="flex gap-3"><span aria-hidden className="mt-2.5 size-1 shrink-0 rounded-full bg-mute" />{i}</li>)}</ul>
);

export default async function CaseStudyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = caseStudyBySlug(slug);
  if (!c) notFound();
  const tone = c.group === "engineering" ? "text-eng-ink" : c.group === "data" ? "text-data-ink" : "text-ink";
  const others = caseStudies.filter((x) => x.slug !== c.slug && x.category.some((k) => c.category.includes(k))).slice(0, 3);

  return (
    <>
      <article>
        <header className="relative overflow-hidden border-b border-line pb-14 pt-36 sm:pt-44">
          <div aria-hidden className="absolute inset-0 bg-grid bg-grid-fade" />
          <Container className="relative">
            <Link href="/work" className="inline-flex items-center gap-2 text-sm text-mute hover:text-ink"><ArrowLeft className="size-4" aria-hidden /> All work</Link>
            <p className={cx("mt-8 font-mono text-xs uppercase tracking-[0.14em]", tone)}>{c.domain} · {c.projectType}</p>
            <h1 className="mt-4 max-w-4xl font-display text-[clamp(2.2rem,5vw,4.2rem)] font-semibold leading-[1.0] tracking-[-0.035em] text-balance">{c.title}</h1>
            <p className="mt-6 max-w-[60ch] text-lg leading-relaxed text-mute">{c.shortDescription}</p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <StatusBadge status={c.projectStatus} />
              <span className="rounded-full border border-line-strong px-2.5 py-1 font-mono text-[0.68rem] uppercase tracking-[0.08em] text-mute">{c.confidentiality}</span>
            </div>
          </Container>
        </header>

        <Container className="grid gap-14 py-16 lg:grid-cols-[minmax(0,8fr)_minmax(0,4fr)] lg:py-24">
          <div className="space-y-12">
            <Block title="Context & challenge"><p>{c.businessChallenge}</p></Block>
            <Block title="Objectives"><List items={c.objectives} /></Block>
            <Block title="Solution approach"><List items={c.technicalApproach} /></Block>
            <Block title="Architecture">
              <ol className="flex flex-wrap items-center gap-2" aria-label="Architecture flow">
                {c.architecture.map((a, i) => (
                  <li key={a} className="flex items-center gap-2">
                    <span className={cx("rounded-lg border px-3 py-2 font-mono text-xs", i === 0 ? "border-eng/50 text-eng-ink" : i === c.architecture.length - 1 ? "border-data/50 text-data-ink" : "border-line-strong text-ink")}>{a}</span>
                    {i < c.architecture.length - 1 && <ArrowRight className="size-3.5 text-dim" aria-hidden />}
                  </li>
                ))}
              </ol>
              <p className="mt-3 text-xs text-dim">Simplified and anonymised. No private infrastructure details are published.</p>
            </Block>
            <Block title="Important technical decisions"><List items={c.decisions} /></Block>
            <Block title="Operational considerations"><List items={c.operational} /></Block>
            {c.results.length > 0 && <Block title="Results"><List items={c.results} /></Block>}
            {c.lessons.length > 0 && <Block title="Lessons learned"><List items={c.lessons} /></Block>}
            {c.demoUrl && (
              <Block title="Visual demonstration">
                <p>An interactive, synthetic demonstration related to this work is available in the laboratory.</p>
                <ButtonLink href={c.demoUrl} variant="ghost" className="mt-4">Open demonstration</ButtonLink>
              </Block>
            )}
          </div>

          <aside className="space-y-8 lg:sticky lg:top-24 lg:self-start" aria-label="Project facts">
            <dl className="space-y-5 rounded-2xl border border-line bg-panel p-6 text-sm">
              <div><dt className="font-mono text-[0.65rem] uppercase tracking-[0.12em] text-dim">Contributor</dt><dd className="mt-1 text-ink">{c.contributor.map((id) => founderById(id).displayName).join(" + ")}</dd></div>
              <div><dt className="font-mono text-[0.65rem] uppercase tracking-[0.12em] text-dim">Role</dt><dd className="mt-1 text-mute">{c.contributionDescription}</dd></div>
              <div><dt className="font-mono text-[0.65rem] uppercase tracking-[0.12em] text-dim">Categories</dt><dd className="mt-1 text-mute">{c.category.join(", ")}</dd></div>
              <div>
                <dt className="font-mono text-[0.65rem] uppercase tracking-[0.12em] text-dim">Technologies</dt>
                <dd className="mt-2 flex flex-wrap gap-1.5">{c.technologies.map((t) => <span key={t} className="rounded-md border border-line-strong px-2 py-1 font-mono text-[0.7rem] text-mute">{t}</span>)}</dd>
              </div>
              {c.verifiedEvidence.length > 0 && (
                <div>
                  <dt className="font-mono text-[0.65rem] uppercase tracking-[0.12em] text-dim">Evidence</dt>
                  <dd className="mt-1 text-mute">{c.verifiedEvidence.join("; ")}</dd>
                </div>
              )}
              {c.repositoryUrl && <div><dt className="sr-only">Repository</dt><dd><a href={c.repositoryUrl} className="inline-flex items-center gap-1.5 text-ink underline" target="_blank" rel="noreferrer noopener">Repository <ExternalLink className="size-3.5" aria-hidden /></a></dd></div>}
            </dl>
            <div className="rounded-2xl border border-line bg-panel p-6">
              <p className="font-mono text-[0.65rem] uppercase tracking-[0.12em] text-dim">Related services</p>
              <ul className="mt-3 space-y-2 text-sm">
                {c.relatedPractices.map((s) => { const p = practiceBySlug(s)!; return <li key={s}><Link href={`/solutions/${s}`} className="text-ink hover:underline">{p.index} — {p.name}</Link></li>; })}
              </ul>
              <ButtonLink href="/contact?intent=project" className="mt-6 w-full">Discuss a similar project</ButtonLink>
            </div>
          </aside>
        </Container>

        {others.length > 0 && (
          <Container className="pb-20">
            <h2 className="font-display text-xl text-ink">Related work</h2>
            <ul className="mt-4 divide-y divide-line border-y border-line">
              {others.map((o) => (
                <li key={o.slug}>
                  <Link href={`/work/${o.slug}`} className="group flex items-center justify-between gap-4 py-4 text-mute hover:text-ink">
                    <span>{o.title}</span><ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </Container>
        )}
      </article>
      <CtaBand />
    </>
  );
}
