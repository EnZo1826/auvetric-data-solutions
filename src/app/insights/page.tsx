import Link from "next/link";
import { PageHero, CtaBand } from "@/components/sections/CtaBand";
import { Container, Section, cx } from "@/components/ui/primitives";
import { insights } from "@/data/insights";
import { founderById } from "@/data/founders";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  title: "Insights",
  description: "Technical and data articles on offline-first applications, industrial monitoring, data integrity and practical automation.",
  path: "/insights",
});

const tone = { engineering: "text-eng-ink", data: "text-data-ink", unified: "text-ink" } as const;

export default function InsightsPage() {
  const published = insights.filter((i) => i.status === "published" && i.body?.length);
  const planned = insights.filter((i) => !(i.status === "published" && i.body?.length));
  return (
    <>
      <PageHero
        title={<>Insights.</>}
        intro="Practical writing from both disciplines. Articles are published here once they are written and reviewed — the topics below are in preparation."
      />
      <Section className="pt-14 sm:pt-16">
        <Container>
          {published.length === 0 && (
            <p className="mb-8 rounded-xl border border-line bg-panel p-4 text-sm text-mute">No articles published yet. Want to be told when one is? <Link href="/contact?intent=general" className="text-ink underline">Get in touch</Link>.</p>
          )}
          <h2 className="font-mono text-xs uppercase tracking-[0.14em] text-dim">In preparation</h2>
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {planned.map((i) => (
              <li key={i.slug} className="grid gap-2 py-6 md:grid-cols-[1fr_14rem] md:items-baseline md:gap-8">
                <div>
                  <p className={cx("font-mono text-[0.68rem] uppercase tracking-[0.12em]", tone[i.discipline])}>{i.discipline === "unified" ? "Engineering × Data" : i.discipline === "engineering" ? "Engineering" : "Data & BI"}</p>
                  <h3 className="mt-2 font-display text-xl leading-snug tracking-[-0.01em] text-ink">{i.title}</h3>
                  <p className="mt-1.5 text-sm text-mute">{i.summary}</p>
                </div>
                <p className="text-sm text-dim md:text-right">{i.author.map((a) => founderById(a).displayName).join(" & ")} · <span className="text-warn">{i.status === "drafting" ? "Drafting" : "Proposed"}</span></p>
              </li>
            ))}
          </ul>
        </Container>
      </Section>
      <CtaBand />
    </>
  );
}
