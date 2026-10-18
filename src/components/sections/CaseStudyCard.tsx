import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { CaseStudy } from "@/data/projects";
import { founderById } from "@/data/founders";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { cx } from "@/components/ui/primitives";

const groupLabel = { engineering: "Engineering", data: "Data & BI", unified: "Unified concept" } as const;
const groupTone = { engineering: "text-eng-ink", data: "text-data-ink", unified: "text-ink" } as const;
const groupRule = { engineering: "from-eng to-eng/0", data: "from-data to-data/0", unified: "from-eng via-ink/50 to-data" } as const;

export function CaseStudyCard({ c, className }: { c: CaseStudy; className?: string }) {
  return (
    <article className={cx("group relative flex h-full flex-col rounded-2xl border border-line bg-panel p-6 transition-[border-color,transform] duration-500 hover:-translate-y-0.5 hover:border-line-strong", className)}>
      <span aria-hidden className={cx("absolute inset-x-6 top-0 h-px bg-gradient-to-r", groupRule[c.group])} />
      <div className="flex items-center justify-between gap-3">
        <p className={cx("font-mono text-[0.68rem] uppercase tracking-[0.12em]", groupTone[c.group])}>{groupLabel[c.group]} · {c.domain}</p>
      </div>
      <h3 className="mt-3 font-display text-xl leading-snug tracking-[-0.01em] text-ink">
        <Link href={`/work/${c.slug}`} className="after:absolute after:inset-0 after:content-['']">{c.title}</Link>
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-mute">{c.shortDescription}</p>
      <div className="mt-auto pt-6">
        <StatusBadge status={c.projectStatus} verified={c.statusVerified} />
        <div className="mt-4 flex items-center justify-between text-xs text-dim">
          <span>{c.contributor.map((id) => founderById(id).displayName).join(" + ")}</span>
          <ArrowUpRight className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-ink" aria-hidden />
        </div>
      </div>
    </article>
  );
}
